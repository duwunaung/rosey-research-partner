import React, { useEffect, useRef, useState } from 'react'
import { AlertCircle, HelpCircle, Network } from 'lucide-react'

interface GraphNode {
  id: string
  title: string
  url: string
  score: number | null
  status: string
  parentId: string | null
  justification: string | null
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

interface GraphLink {
  source: string
  target: string
  type: 'relation' | 'similarity'
  sharedWords?: string[]
}

interface KnowledgeGraphProps {
  urls: any[]
  selectedUrlId: string | null
  onSelectUrl: (url: any) => void
}

export default function KnowledgeGraph({ urls, selectedUrlId, onSelectUrl }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [hoveredLink, setHoveredLink] = useState<GraphLink | null>(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 })
  const [, setTick] = useState(0)

  const nodesRef = useRef<GraphNode[]>([])
  const linksRef = useRef<GraphLink[]>([])
  const draggingNodeIdRef = useRef<string | null>(null)
  const pointerPosRef = useRef({ x: 0, y: 0 })

  // Stop words for keyword overlap check
  const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'what', 'how', 'why',
    'you', 'are', 'not', 'but', 'out', 'into', 'over', 'both', 'some', 'than', 'then',
    'them', 'their', 'they', 'our', 'new', 'api', 'app', 'tool', 'code', 'web', 'page', 'site'
  ])

  // Get dimensions on mount and resize
  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setDimensions({
          width: Math.max(width, 300),
          height: Math.max(height, 350)
        })
      }
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  // Construct Nodes and Links when URLs list changes
  useEffect(() => {
    const w = dimensions.width
    const h = dimensions.height

    // 1. Build Nodes
    const newNodes: GraphNode[] = urls.map((u) => {
      // Preserve coordinates of existing nodes if they match
      const existing = nodesRef.current.find(n => n.id === u.id)
      
      let radius = 10
      if (u.status === 'COMPLETED') {
        const score = u.score || 5
        radius = 12 + (score * 1.5) // Radius matches score
      } else if (u.status === 'SCRAPING' || u.status === 'SUMMARIZING') {
        radius = 12
      }

      return {
        id: u.id,
        title: u.title || new URL(u.url).hostname,
        url: u.url,
        score: u.score,
        status: u.status,
        parentId: u.parentId,
        justification: u.justification,
        x: existing?.x || (w / 2) + (Math.random() - 0.5) * (w / 2),
        y: existing?.y || (h / 2) + (Math.random() - 0.5) * (h / 2),
        vx: existing?.vx || 0,
        vy: existing?.vy || 0,
        radius
      }
    })

    // 2. Build Links
    const newLinks: GraphLink[] = []

    // A. Add explicit parent-child relational links
    newNodes.forEach((node) => {
      if (node.parentId) {
        // Verify parent actually exists in current topic list
        const parentExists = newNodes.some(n => n.id === node.parentId)
        if (parentExists) {
          newLinks.push({
            source: node.parentId,
            target: node.id,
            type: 'relation'
          })
        }
      }
    })

    // B. Calculate keyword overlap links between completed nodes
    const completedNodes = newNodes.filter(n => n.status === 'COMPLETED')
    for (let i = 0; i < completedNodes.length; i++) {
      const nodeA = completedNodes[i]
      const wordsA = nodeA.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w))

      for (let j = i + 1; j < completedNodes.length; j++) {
        const nodeB = completedNodes[j]
        
        // Skip link if they already share a parent-child relationship
        if (nodeA.parentId === nodeB.id || nodeB.parentId === nodeA.id) continue

        const wordsB = nodeB.title
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 3 && !STOP_WORDS.has(w))

        // Find intersections
        const shared = wordsA.filter(w => wordsB.includes(w))
        if (shared.length > 0) {
          newLinks.push({
            source: nodeA.id,
            target: nodeB.id,
            type: 'similarity',
            sharedWords: shared
          })
        }
      }
    }

    nodesRef.current = newNodes
    linksRef.current = newLinks
    setNodes(newNodes)
    setLinks(newLinks)
  }, [urls, dimensions.width, dimensions.height])

  // Physics Simulation Loop
  useEffect(() => {
    let animationFrameId: number

    const tickSim = () => {
      const currentNodes = nodesRef.current
      const currentLinks = linksRef.current
      const draggedNodeId = draggingNodeIdRef.current
      const pointerPos = pointerPosRef.current

      const w = dimensions.width
      const h = dimensions.height
      const cx = w / 2
      const cy = h / 2

      // Force coefficients
      const kRepulsion = 800 // Pushing nodes apart
      const kSpring = 0.05    // Link stiffness
      const dSpring = 120    // Ideal link distance
      const kGravity = 0.015  // Pulling nodes toward center
      const damping = 0.82   // Slowing things down

      // 1. Apply node repulsion (Coulomb's force)
      for (let i = 0; i < currentNodes.length; i++) {
        const nodeA = currentNodes[i]
        for (let j = i + 1; j < currentNodes.length; j++) {
          const nodeB = currentNodes[j]

          const dx = nodeB.x - nodeA.x
          const dy = nodeB.y - nodeA.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1

          // Stronger repulsion if nodes are very close
          const repulsionForce = kRepulsion / (dist * dist)
          const fx = (dx / dist) * repulsionForce
          const fy = (dy / dist) * repulsionForce

          // Push them apart
          if (nodeA.id !== draggedNodeId) {
            nodeA.vx -= fx
            nodeA.vy -= fy
          }
          if (nodeB.id !== draggedNodeId) {
            nodeB.vx += fx
            nodeB.vy += fy
          }
        }
      }

      // 2. Apply link forces (Hooke's spring force)
      currentLinks.forEach((link) => {
        const sourceNode = currentNodes.find(n => n.id === link.source)
        const targetNode = currentNodes.find(n => n.id === link.target)

        if (!sourceNode || !targetNode) return

        const dx = targetNode.x - sourceNode.x
        const dy = targetNode.y - sourceNode.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1

        const delta = dist - dSpring
        const springForce = delta * kSpring
        const fx = (dx / dist) * springForce
        const fy = (dy / dist) * springForce

        // Pull together
        if (sourceNode.id !== draggedNodeId) {
          sourceNode.vx += fx
          sourceNode.vy += fy
        }
        if (targetNode.id !== draggedNodeId) {
          targetNode.vx -= fx
          targetNode.vy -= fy
        }
      })

      // 3. Apply gravity (centering force) & boundary locks
      currentNodes.forEach((node) => {
        if (node.id === draggedNodeId) {
          node.x = pointerPos.x
          node.y = pointerPos.y
          node.vx = 0
          node.vy = 0
          return
        }

        // Center gravity
        const dx = cx - node.x
        const dy = cy - node.y
        node.vx += dx * kGravity
        node.vy += dy * kGravity

        // Apply velocities
        node.vx *= damping
        node.vy *= damping
        node.x += node.vx
        node.y += node.vy

        // Bound nodes within viewport padding
        const pad = node.radius + 10
        if (node.x < pad) { node.x = pad; node.vx *= -0.5; }
        if (node.x > w - pad) { node.x = w - pad; node.vx *= -0.5; }
        if (node.y < pad) { node.y = pad; node.vy *= -0.5; }
        if (node.y > h - pad) { node.y = h - pad; node.vy *= -0.5; }
      })

      // Trigger re-render
      setTick(t => t + 1)
      animationFrameId = requestAnimationFrame(tickSim)
    }

    animationFrameId = requestAnimationFrame(tickSim)
    return () => cancelAnimationFrame(animationFrameId)
  }, [dimensions.width, dimensions.height])

  // Drag Handlers
  const handlePointerDown = (nodeId: string, e: React.PointerEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    draggingNodeIdRef.current = nodeId
    pointerPosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingNodeIdRef.current === null || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    pointerPosRef.current = {
      x: Math.max(10, Math.min(rect.width - 10, e.clientX - rect.left)),
      y: Math.max(10, Math.min(rect.height - 10, e.clientY - rect.top))
    }
  }

  const handlePointerUp = (nodeId: string, e: React.PointerEvent) => {
    draggingNodeIdRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    
    // Trigger callback click if pointer didn't drag much
    const matchedUrl = urls.find(u => u.id === nodeId)
    if (matchedUrl) {
      onSelectUrl(matchedUrl)
    }
  }

  // Node Color styles based on status & score
  const getNodeColor = (node: GraphNode, isSelected: boolean) => {
    if (isSelected) return 'fill-cyber-cyan stroke-white stroke-2 shadow-[0_0_15px_rgba(6,182,212,0.8)]'

    switch (node.status) {
      case 'PENDING':
        return 'fill-slate-800 stroke-slate-600'
      case 'SCRAPING':
      case 'SUMMARIZING':
        return 'fill-cyber-indigo stroke-cyber-cyan stroke-2 animate-pulse'
      case 'FAILED':
        return 'fill-red-950 stroke-red-600'
      case 'COMPLETED':
        const score = node.score || 5
        if (score >= 8) return 'fill-cyber-cyan/35 stroke-cyber-cyan border border-cyber-cyan shadow-[0_0_10px_rgba(6,182,212,0.4)]'
        if (score >= 5) return 'fill-cyber-indigo/35 stroke-cyber-indigo border border-cyber-indigo shadow-[0_0_10px_rgba(99,102,241,0.4)]'
        return 'fill-emerald-950/45 stroke-cyber-emerald border border-cyber-emerald'
      default:
        return 'fill-slate-700 stroke-slate-500'
    }
  }

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col min-h-[400px] bg-cyber-dark/45 border border-white/5 rounded-2xl overflow-hidden select-none">
      {/* Legend & Stats Overlay */}
      <div className="absolute top-3 left-3 bg-[#0a0a0f]/80 backdrop-blur-md px-3 py-2 rounded-lg border border-white/5 text-[9px] font-mono text-slate-400 space-y-1.5 z-10">
        <div className="flex items-center gap-1 text-slate-300 uppercase tracking-wider mb-1">
          <Network className="w-3 h-3 text-cyber-cyan" /> COGNITIVE NETWORK MESH
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyber-cyan" /> High Relevance (&ge;8)
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyber-indigo" /> Mid Relevance (5-7)
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-600" /> Low Relevance (&lt;5)
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-700" /> Ingestion Pending
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" /> Processing Cores
        </div>
      </div>

      <div className="absolute top-3 right-3 bg-[#0a0a0f]/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/5 text-[9px] font-mono text-slate-400 flex items-center gap-1.5 z-10">
        <HelpCircle className="w-3 h-3 text-slate-500" /> Drag nodes to explore. Click to inspect source.
      </div>

      {/* SVG Canvas */}
      <svg className="flex-1 w-full h-full bg-[#050508]/20 cursor-grab active:cursor-grabbing">
        {/* Draw Connection Links */}
        {links.map((link, idx) => {
          const source = nodes.find(n => n.id === link.source)
          const target = nodes.find(n => n.id === link.target)

          if (!source || !target) return null

          const isHovered = hoveredLink === link
          const isSelected = selectedUrlId === source.id || selectedUrlId === target.id

          return (
            <line
              key={idx}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              className={`transition-all ${
                link.type === 'relation'
                  ? 'stroke-cyber-cyan/50 stroke-1 [stroke-dasharray:4_3]'
                  : 'stroke-white/10 stroke-1'
              } ${isHovered ? 'stroke-cyber-cyan stroke-[2px] opacity-100' : ''} ${
                isSelected && link.type === 'relation' ? 'stroke-cyber-cyan stroke-[1.5px]' : ''
              }`}
              onMouseEnter={() => setHoveredLink(link)}
              onMouseLeave={() => setHoveredLink(null)}
            />
          )
        })}

        {/* Draw Nodes */}
        {nodes.map((node) => {
          const isSelected = selectedUrlId === node.id
          const isHovered = hoveredNode?.id === node.id

          return (
            <g key={node.id} className="cursor-pointer group">
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius + (isHovered ? 2 : 0)}
                className={`transition-colors duration-200 ${getNodeColor(node, isSelected)}`}
                onPointerDown={(e) => handlePointerDown(node.id, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => handlePointerUp(node.id, e)}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              />
              {/* Glowing outer core for processing states */}
              {(node.status === 'SCRAPING' || node.status === 'SUMMARIZING') && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius + 6}
                  className="fill-none stroke-cyber-indigo/30 stroke-1 animate-ping"
                />
              )}

              {/* Node Title Label (Shortened) */}
              <text
                x={node.x}
                y={node.y + node.radius + 13}
                textAnchor="middle"
                className={`text-[9px] font-mono tracking-tight select-none transition-opacity duration-200 pointer-events-none ${
                  isSelected || isHovered
                    ? 'fill-white opacity-100 font-bold'
                    : 'fill-slate-400 opacity-60'
                }`}
              >
                {node.title.length > 18 ? `${node.title.slice(0, 15)}...` : node.title}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Floating Detailed Panel on Hover */}
      {hoveredNode && (
        <div className="absolute bottom-3 left-3 right-3 bg-[#0a0a0f]/90 backdrop-blur-md p-3 rounded-xl border border-white/10 text-xs font-sans text-slate-300 z-20 flex flex-col gap-1.5 shadow-[0_4px_30px_rgba(0,0,0,0.8)] animate-cyber-glow">
          <div className="flex justify-between items-center">
            <span className="font-bold text-white truncate max-w-[70%]">{hoveredNode.title}</span>
            <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
              hoveredNode.status === 'COMPLETED'
                ? 'bg-cyber-cyan/10 border-cyber-cyan/30 text-cyber-cyan'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}>
              {hoveredNode.status} {hoveredNode.score ? `(Score: ${hoveredNode.score}/10)` : ''}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono truncate">{hoveredNode.url}</p>
          {hoveredNode.justification && (
            <p className="text-[11px] italic text-slate-400 border-l border-cyber-indigo/40 pl-2 mt-1">
              "{hoveredNode.justification}"
            </p>
          )}
        </div>
      )}

      {/* Floating Keywords Match Panel on Hover */}
      {hoveredLink && hoveredLink.sharedWords && hoveredLink.sharedWords.length > 0 && (
        <div className="absolute bottom-3 left-3 bg-[#0a0a0f]/95 backdrop-blur-md p-2 rounded-lg border border-cyber-indigo/30 text-[10px] font-mono text-cyber-indigo z-20 shadow-lg animate-pulse">
          <span className="text-slate-400">Overlap terms:</span> {hoveredLink.sharedWords.join(', ')}
        </div>
      )}
    </div>
  )
}
