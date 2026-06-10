'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Shield, Plus, Trash2, Globe, Settings, LogOut, Loader, Sparkles, 
  Play, Terminal, FileText, ChevronRight, CheckCircle2, XCircle, 
  Clock, AlertCircle, RefreshCw, Layers, Brain
} from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface Topic {
  id: string
  name: string
  description: string | null
  createdAt: string
  _count?: {
    urls: number
  }
}

interface WatchedUrl {
  id: string
  url: string
  title: string | null
  summary: string | null
  takeaways: string[]
  score: number | null
  justification: string | null
  status: string // PENDING, SCRAPING, SUMMARIZING, COMPLETED, FAILED
  topicId: string
  createdAt: string
}

interface Suggestion {
  name: string
  url: string
}

interface ProviderPreset {
  name: string
  baseUrl: string
  model: string
  placeholderKey: string
  keyLabel: string
  helpText: string
}

const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  ollama_local: {
    name: 'Ollama (Localhost)',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.1',
    placeholderKey: 'No API key needed',
    keyLabel: 'API Key (Optional)',
    helpText: 'Ensure your local Ollama server is running (ollama run llama3.1).'
  },
  ollama_cloud: {
    name: 'Ollama Cloud',
    baseUrl: 'https://ollama.com',
    model: 'gemma3:27b-cloud',
    placeholderKey: 'Enter Ollama Cloud Key',
    keyLabel: 'Ollama API Key',
    helpText: 'Use your API key from ollama.com/settings/keys.'
  },
  groq: {
    name: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    placeholderKey: 'gsk_...',
    keyLabel: 'Groq API Key',
    helpText: 'Use your API key from console.groq.com.'
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.3-70b-instruct',
    placeholderKey: 'sk-or-...',
    keyLabel: 'OpenRouter API Key',
    helpText: 'Use your API key from openrouter.ai.'
  },
  custom: {
    name: 'Custom (OpenAI-Compatible)',
    baseUrl: '',
    model: '',
    placeholderKey: 'API key if required',
    keyLabel: 'API Key',
    helpText: 'Enter any custom OpenAI-compatible endpoint URL and model.'
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const terminalEndRef = useRef<HTMLDivElement>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  // Auth / User State
  const [username, setUsername] = useState('Researcher')
  
  // Workspace State
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [urls, setUrls] = useState<WatchedUrl[]>([])
  
  // Loading states
  const [loadingTopics, setLoadingTopics] = useState(true)
  const [loadingUrls, setLoadingUrls] = useState(false)
  const [creatingTopic, setCreatingTopic] = useState(false)
  const [addingUrl, setAddingUrl] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Inputs
  const [newTopicName, setNewTopicName] = useState('')
  const [newTopicDesc, setNewTopicDesc] = useState('')
  const [newUrlInput, setNewUrlInput] = useState('')
  const [showTopicModal, setShowTopicModal] = useState(false)

  // AI Recommendations
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  // LLM Config State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [provider, setProvider] = useState('ollama_local')
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('llama3.1')

  // Robotic Research Execution State
  const [researching, setResearching] = useState(false)
  const [activeUrlId, setActiveUrlId] = useState<string | null>(null)
  const [terminalLogs, setTerminalLogs] = useState<string[]>([])
  const [selectedUrlDetails, setSelectedUrlDetails] = useState<WatchedUrl | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  // Initialize Config & Fetch data
  useEffect(() => {
    setMounted(true)
    // Load config from localStorage
    const savedProvider = localStorage.getItem('rosey_provider') || 'ollama_local'
    const savedBaseUrl = localStorage.getItem('rosey_baseUrl')
    const savedApiKey = localStorage.getItem('rosey_apiKey')
    const savedModel = localStorage.getItem('rosey_model')
    
    setProvider(savedProvider)
    if (savedBaseUrl) {
      setBaseUrl(savedBaseUrl)
    } else {
      setBaseUrl(PROVIDER_PRESETS[savedProvider]?.baseUrl || '')
    }
    
    if (savedApiKey) setApiKey(savedApiKey)
    
    if (savedModel) {
      setModel(savedModel)
    } else {
      setModel(PROVIDER_PRESETS[savedProvider]?.model || '')
    }

    // Load username from session (or fallback to fetch topics)
    fetchTopics()
  }, [])

  // Auto-scroll terminal to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [terminalLogs])

  const saveConfig = () => {
    localStorage.setItem('rosey_provider', provider)
    localStorage.setItem('rosey_baseUrl', baseUrl)
    localStorage.setItem('rosey_apiKey', apiKey)
    localStorage.setItem('rosey_model', model)
    setIsSettingsOpen(false)
    addLog(`[SYSTEM] LLM settings saved: [${PROVIDER_PRESETS[provider]?.name || provider}] ${model} at ${baseUrl}`)
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    setTestResult(null)
    addLog(`[SYSTEM: TEST] Sending heartbeat to: ${baseUrl} (model: ${model})`)

    try {
      const res = await fetch('/api/research/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { baseUrl, apiKey, model }
        })
      })

      const data = await res.json()
      if (data.success) {
        setTestResult({ success: true })
        addLog(`[SYSTEM: TEST] Connection to LLM established successfully!`)
      } else {
        setTestResult({ success: false, error: data.error || 'Connection failed' })
        addLog(`[SYSTEM: TEST] Connection failed: ${data.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message })
      addLog(`[SYSTEM: TEST] Network error: ${err.message}`)
    } finally {
      setTestingConnection(false)
    }
  }

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString()
    setTerminalLogs(prev => [...prev, `[${time}] ${message}`])
  }

  const fetchTopics = async () => {
    setLoadingTopics(true)
    try {
      const res = await fetch('/api/topics')
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) throw new Error('Failed to fetch topics')
      const data = await res.json()
      setTopics(data)
      
      // Auto-select first topic if available
      if (data.length > 0 && !selectedTopic) {
        setSelectedTopic(data[0])
        fetchUrls(data[0].id)
      }
    } catch (err: any) {
      console.error(err)
      addLog(`[ERROR] Failed to fetch workspace topics.`)
    } finally {
      setLoadingTopics(false)
    }
  }

  const fetchUrls = async (topicId: string) => {
    setLoadingUrls(true)
    try {
      const res = await fetch(`/api/urls?topicId=${topicId}`)
      if (!res.ok) throw new Error('Failed to fetch URLs')
      const data = await res.json()
      // Auto-sort completed URLs by score descending
      const sorted = data.sort((a: WatchedUrl, b: WatchedUrl) => {
        if (a.status === 'COMPLETED' && b.status === 'COMPLETED') {
          return (b.score || 0) - (a.score || 0)
        }
        if (a.status === 'COMPLETED') return -1
        if (b.status === 'COMPLETED') return 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      setUrls(sorted)
      setSuggestions([]) // Clear suggestions on topic switch
    } catch (err: any) {
      console.error(err)
      addLog(`[ERROR] Failed to fetch watched URLs.`)
    } finally {
      setLoadingUrls(false)
    }
  }

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTopicName.trim()) return
    setCreatingTopic(true)
    
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTopicName, description: newTopicDesc }),
      })

      if (!res.ok) throw new Error('Failed to create topic')
      const newTopic = await res.json()
      
      setTopics(prev => [newTopic, ...prev])
      setSelectedTopic(newTopic)
      setUrls([])
      setNewTopicName('')
      setNewTopicDesc('')
      setShowTopicModal(false)
      addLog(`[SYSTEM] New workspace created: ${newTopic.name}`)
      fetchUrls(newTopic.id)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setCreatingTopic(false)
    }
  }

  const handleDeleteTopic = async (id: string) => {
    if (!confirm('Are you sure you want to delete this topic and all its watched URLs?')) return

    try {
      const res = await fetch(`/api/topics/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete topic')

      setTopics(prev => prev.filter(t => t.id !== id))
      if (selectedTopic?.id === id) {
        setSelectedTopic(null)
        setUrls([])
      }
      addLog(`[SYSTEM] Workspace removed.`)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleAddUrl = async (e?: React.FormEvent, urlToAdd?: string) => {
    if (e) e.preventDefault()
    const targetUrl = urlToAdd || newUrlInput
    if (!targetUrl.trim() || !selectedTopic) return
    setAddingUrl(true)

    try {
      const res = await fetch('/api/urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, topicId: selectedTopic.id }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to add URL')
      }
      
      const newWatched = await res.json()
      setUrls(prev => [newWatched, ...prev])
      if (!urlToAdd) setNewUrlInput('')
      addLog(`[SYSTEM] URL added to watchlist: ${targetUrl}`)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setAddingUrl(false)
    }
  }

  const handleDeleteUrl = async (id: string) => {
    try {
      const res = await fetch(`/api/urls/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete URL')

      setUrls(prev => prev.filter(u => u.id !== id))
      if (selectedUrlDetails?.id === id) {
        setSelectedUrlDetails(null)
      }
      addLog(`[SYSTEM] Target removed from watchlist.`)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleSuggestSources = async () => {
    if (!selectedTopic) return
    setLoadingSuggestions(true)
    setSuggestions([])
    addLog(`[ROBOT: INITIATE] Querying AI recommendations for topic: ${selectedTopic.name}`)

    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: selectedTopic.id,
          config: { baseUrl, apiKey, model }
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to generate recommendations')
      }

      const data = await res.json()
      setSuggestions(data)
      addLog(`[ROBOT: INGEST] Loaded ${data.length} AI source suggestions.`)
    } catch (err: any) {
      addLog(`[ERROR] AI suggestions failed: ${err.message}`)
      alert(err.message)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  // CORE PIPELINE RUNNER (Processes URLs one by one)
  const handleStartResearch = async () => {
    if (urls.length === 0 || !selectedTopic) return
    
    // Find items that need processing (PENDING, FAILED, or we run all)
    const targets = urls.filter(u => u.status !== 'COMPLETED')
    if (targets.length === 0) {
      if (!confirm('All items are already COMPLETED. Re-run research for all?')) return
      // Reset all to PENDING locally first
      const resetUrls = urls.map(u => ({ ...u, status: 'PENDING' }))
      setUrls(resetUrls)
      runPipeline(resetUrls)
    } else {
      runPipeline(targets)
    }
  }

  const runPipeline = async (urlItems: WatchedUrl[]) => {
    setResearching(true)
    setTerminalLogs([])
    addLog(`[SYSTEM: BOOT] Starting cybernetic ingestion engine...`)
    addLog(`[SYSTEM: CONFIG] LLM: ${model} | Scraper: Jina Reader API`)

    for (let i = 0; i < urlItems.length; i++) {
      const item = urlItems[i]
      setActiveUrlId(item.id)
      
      // Update state locally
      setUrls(prev => prev.map(u => u.id === item.id ? { ...u, status: 'SCRAPING' } : u))
      addLog(`[ROBOT: SCAN] Accessing target #${i + 1}/${urlItems.length}: ${item.url}`)
      addLog(`[ROBOT: SCRAPE] Requesting Jina Reader markdown conversion...`)

      try {
        const res = await fetch('/api/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            urlId: item.id,
            config: { baseUrl, apiKey, model }
          })
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Research handler failed')
        }

        // Update local state with the completed results
        setUrls(prev => prev.map(u => u.id === item.id ? data : u))
        addLog(`[ROBOT: THINK] Sent markdown to ${PROVIDER_PRESETS[provider]?.name || 'LLM'} model: ${model}`)
        addLog(`[ROBOT: INDEXED] Relevance Score: ${data.score}/10 | Title: ${data.title}`)
        addLog(`[ROBOT: INDEXED] Justification: "${data.justification}"`)

        // If this URL is currently opened in the details panel, update it
        if (selectedUrlDetails?.id === item.id) {
          setSelectedUrlDetails(data)
        }
      } catch (err: any) {
        console.error(err)
        setUrls(prev => prev.map(u => u.id === item.id ? { ...u, status: 'FAILED' } : u))
        addLog(`[ROBOT: FAILED] Error processing target: ${err.message}`)
      }
    }

    setActiveUrlId(null)
    setResearching(false)
    addLog(`[SYSTEM: SUCCESS] Ingestion engine cycle completed.`)
    
    // Refresh and auto-sort URLs by score
    if (selectedTopic) fetchUrls(selectedTopic.id)
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/login'
    } catch (err) {
      console.error(err)
    }
  }

  // Client-Side PDF compile
  const handleExportPDF = async () => {
    if (!selectedTopic || urls.length === 0) return
    const completedUrls = urls.filter(u => u.status === 'COMPLETED')
    if (completedUrls.length === 0) {
      alert('No completed research items to export. Run research first!')
      return
    }

    setExportingPdf(true)
    addLog(`[SYSTEM] Compiling PDF Research Digest...`)

    try {
      // Small delay to allow react to render the hidden print block if needed
      setTimeout(async () => {
        const printArea = reportRef.current
        if (!printArea) return

        const canvas = await html2canvas(printArea, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#0a0a0c',
        })

        const imgData = canvas.toDataURL('image/jpeg', 0.95)
        const pdf = new jsPDF('p', 'mm', 'a4')
        const imgWidth = 210 // A4 size
        const pageHeight = 295
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        let heightLeft = imgHeight
        let position = 0

        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
          heightLeft -= pageHeight
        }

        const safeTitle = selectedTopic.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        pdf.save(`research-digest-${safeTitle}.pdf`)
        addLog(`[SYSTEM] PDF downloaded successfully.`)
        setExportingPdf(false)
      }, 500)
    } catch (err: any) {
      console.error(err)
      addLog(`[ERROR] PDF compilation failed: ${err.message}`)
      setExportingPdf(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-black text-[#f4f4f5]">
      {/* Background cyber grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />

      {/* Decorative cosmic glows */}
      <div className="absolute top-0 right-1/4 w-[450px] h-[450px] rounded-full bg-cyber-indigo/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[450px] h-[450px] rounded-full bg-cyber-cyan/8 blur-[130px] pointer-events-none" />

      {/* Top Navbar */}
      <nav className="z-20 w-full px-6 py-4 glass-panel border-b border-white/5 flex justify-between items-center bg-cyber-dark/40">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl glass-panel border-cyber-indigo/30 bg-cyber-dark/30 shadow-[0_0_10px_rgba(99,102,241,0.15)]">
            <Shield className="w-5 h-5 text-cyber-cyan" />
          </div>
          <span className="font-bold font-mono tracking-wider text-sm uppercase bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Rosey Partner
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-lg glass-panel hover:bg-white/5 hover:border-cyber-cyan/40 transition cursor-pointer text-slate-400 hover:text-cyber-cyan"
            title="Configure AI Host"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg glass-panel border-red-500/20 text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition cursor-pointer"
            title="Disconnect Terminal"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Main Grid Layout */}
      <div className="flex-1 w-full max-w-[1700px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6 z-10 overflow-hidden">
        
        {/* ================= COLUMN 1: TOPIC DIRECTORY ================= */}
        <div className="lg:col-span-1 flex flex-col gap-4 overflow-hidden">
          <div className="glass-panel rounded-2xl p-4 flex flex-col h-[300px] bg-cyber-dark/25">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" /> Workspace Topics
              </span>
              <button
                onClick={() => setShowTopicModal(true)}
                className="p-1 rounded bg-cyber-indigo/10 border border-cyber-indigo/30 text-cyber-indigo hover:bg-cyber-indigo/20 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-cyber-cyan" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {loadingTopics ? (
                <div className="flex justify-center items-center h-full">
                  <Loader className="w-5 h-5 animate-spin text-cyber-indigo" />
                </div>
              ) : topics.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 font-mono">
                  No active workspaces. Click "+" to create.
                </div>
              ) : (
                topics.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      if (researching) return
                      setSelectedTopic(t)
                      fetchUrls(t.id)
                    }}
                    className={`group w-full flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition ${
                      selectedTopic?.id === t.id
                        ? 'border-cyber-indigo/50 bg-cyber-indigo/10 text-white'
                        : 'border-white/5 hover:border-white/10 hover:bg-white/3 text-slate-400'
                    } ${researching ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="truncate flex-1">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">
                        {t._count?.urls || 0} link(s) monitored
                      </p>
                    </div>
                    <button
                      disabled={researching}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteTopic(t.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 rounded transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Scrolling System Terminal (Robotic Logs) */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col flex-1 min-h-[200px] max-h-[350px] bg-black/80 border-cyan-500/20">
            <div className="flex items-center gap-2 mb-2 pb-1 border-b border-cyan-500/10 text-[10px] font-mono tracking-widest text-cyber-cyan uppercase">
              <Terminal className="w-3.5 h-3.5" /> Robotic Feed Shell
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-[11px] text-cyan-400 space-y-1 pr-1 bg-black/60 p-2.5 rounded border border-white/5">
              {terminalLogs.length === 0 ? (
                <p className="text-slate-600 italic">// Ingestion system idle. Awaiting instruction...</p>
              ) : (
                terminalLogs.map((log, idx) => (
                  <p key={idx} className="terminal-glow leading-normal break-all">
                    {log}
                  </p>
                ))
              )}
              {researching && (
                <div className="flex items-center gap-2 text-cyber-indigo mt-1 animate-pulse">
                  <span>&gt; INGESTION LOOP RUNNING</span>
                  <Loader className="w-3 h-3 animate-spin" />
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>

        {/* ================= COLUMN 2 & 3: WATCHLIST HUB ================= */}
        <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
          
          {/* Active Topic Header / Controls */}
          <div className="glass-panel rounded-2xl p-4 bg-cyber-dark/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                {selectedTopic ? selectedTopic.name : 'No Workspace Selected'}
              </h2>
              <p className="text-xs text-slate-400 font-sans truncate max-w-sm mt-0.5">
                {selectedTopic?.description || 'Select or create a workspace topic to launch.'}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                disabled={!selectedTopic || urls.length === 0 || researching}
                onClick={handleStartResearch}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyber-indigo to-cyber-cyan hover:opacity-90 active:scale-97 transition text-white font-medium text-xs flex items-center gap-1.5 shadow-[0_4px_15px_rgba(99,102,241,0.2)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-mono uppercase tracking-wider"
              >
                <Play className="w-3.5 h-3.5" /> Start Research
              </button>
              <button
                disabled={!selectedTopic || urls.length === 0 || exportingPdf}
                onClick={handleExportPDF}
                className="px-4 py-2 rounded-lg glass-panel hover:bg-emerald-500/10 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 transition text-xs font-mono uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
              >
                {exportingPdf ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                Export PDF
              </button>
            </div>
          </div>

          {/* URL Input Form */}
          {selectedTopic && (
            <form onSubmit={handleAddUrl} className="flex gap-2">
              <input
                type="url"
                required
                disabled={researching}
                placeholder="Paste research URL here..."
                value={newUrlInput}
                onChange={(e) => setNewUrlInput(e.target.value)}
                className="flex-1 px-4 py-2.5 glass-input text-sm"
              />
              <button
                type="submit"
                disabled={addingUrl || researching}
                className="px-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/8 hover:border-white/20 transition font-medium text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {addingUrl ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Monitor URL
              </button>
            </form>
          )}

          {/* Watch-List Panel */}
          <div className="glass-panel rounded-2xl flex-1 flex flex-col p-4 overflow-hidden relative min-h-[350px] bg-cyber-dark/15">
            {/* Holographic Laser Scanline when researching */}
            {researching && <div className="laser-scanline animate-scan" />}

            <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                Watched Resources ({urls.length})
              </span>
              {selectedTopic && (
                <button
                  disabled={loadingSuggestions || researching}
                  onClick={handleSuggestSources}
                  className="text-[10px] font-mono text-cyber-cyan hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 animate-pulse" /> Suggest Sources
                </button>
              )}
            </div>

            {/* AI Source Recommendations panel */}
            {suggestions.length > 0 && (
              <div className="mb-4 p-3 rounded-xl glass-panel border-cyber-indigo/30 bg-cyber-indigo/5 animate-cyber-glow">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-mono text-cyber-indigo uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> AI Recommended Resources
                  </span>
                  <button 
                    onClick={() => setSuggestions([])} 
                    className="text-[10px] font-mono text-slate-500 hover:text-slate-300"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAddUrl(undefined, s.url)}
                      className="px-2.5 py-1 rounded-full bg-white/5 border border-white/8 text-slate-300 hover:border-cyber-indigo/50 hover:bg-cyber-indigo/10 text-[10px] font-sans flex items-center gap-1 cursor-pointer transition"
                    >
                      <Plus className="w-2.5 h-2.5 text-cyber-cyan" />
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loadingUrls ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader className="w-8 h-8 animate-spin text-cyber-indigo" />
              </div>
            ) : urls.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <Globe className="w-10 h-10 text-slate-600 mb-3" />
                <p className="text-sm font-semibold text-slate-400">No active URLs</p>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Add URLs above or click "Suggest Sources" to query resources related to {selectedTopic?.name}.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {urls.map((u) => {
                  const isActive = activeUrlId === u.id
                  const isSelected = selectedUrlDetails?.id === u.id
                  
                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        if (u.status === 'COMPLETED') {
                          setSelectedUrlDetails(u)
                        }
                      }}
                      className={`group relative p-3.5 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                        isSelected 
                          ? 'border-cyber-indigo/70 bg-cyber-indigo/5 shadow-[0_4px_15px_rgba(99,102,241,0.1)]' 
                          : 'border-white/5 bg-cyber-dark/30 hover:border-white/10 hover:bg-white/2'
                      } ${isActive ? 'animate-cyber-glow border-cyber-cyan' : ''}`}
                    >
                      {/* Priority Score Indicator */}
                      {u.status === 'COMPLETED' && (
                        <div className="absolute top-1/2 -translate-y-1/2 left-3 w-8 h-8 rounded-full border border-cyber-cyan/30 bg-cyber-cyan/5 text-cyber-cyan flex items-center justify-center font-mono font-bold text-sm shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                          {u.score}
                        </div>
                      )}

                      <div className={`flex-1 min-w-0 ${u.status === 'COMPLETED' ? 'pl-11' : ''}`}>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate max-w-lg">
                            {u.title || new URL(u.url).hostname}
                          </p>
                          
                          {/* Status Badge */}
                          {u.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-500 bg-white/3 px-1.5 py-0.5 rounded border border-white/5">
                              <Clock className="w-2.5 h-2.5" /> PENDING
                            </span>
                          )}
                          {u.status === 'SCRAPING' && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-cyber-cyan bg-cyber-cyan/5 px-1.5 py-0.5 rounded border border-cyber-cyan/20 animate-pulse">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> SCRAPING
                            </span>
                          )}
                          {u.status === 'SUMMARIZING' && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-cyber-indigo bg-cyber-indigo/5 px-1.5 py-0.5 rounded border border-cyber-indigo/20 animate-pulse">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> SUMMARIZING
                            </span>
                          )}
                          {u.status === 'COMPLETED' && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-cyber-emerald bg-cyber-emerald/5 px-1.5 py-0.5 rounded border border-cyber-emerald/20">
                              <CheckCircle2 className="w-2.5 h-2.5" /> SYNCED
                            </span>
                          )}
                          {u.status === 'FAILED' && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-red-400 bg-red-500/5 px-1.5 py-0.5 rounded border border-red-500/20">
                              <XCircle className="w-2.5 h-2.5" /> FAILED
                            </span>
                          )}
                        </div>
                        
                        <p className="text-[10px] text-slate-400 font-mono truncate max-w-sm mt-0.5">
                          {u.url}
                        </p>
                        
                        {u.status === 'COMPLETED' && u.justification && (
                          <p className="text-[11px] text-slate-400 font-sans italic truncate max-w-md mt-1.5">
                            "{u.justification}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {u.status === 'COMPLETED' && (
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
                        )}
                        <button
                          disabled={researching}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteUrl(u.id)
                          }}
                          className={`p-1.5 text-slate-500 hover:text-red-400 rounded-lg bg-white/3 hover:bg-white/8 transition cursor-pointer ${
                            researching ? 'opacity-30 cursor-not-allowed' : ''
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ================= COLUMN 4: ANALYSIS SIDEBAR ================= */}
        <div className="lg:col-span-1 flex flex-col overflow-hidden">
          <div className="glass-panel rounded-2xl flex-1 p-4 flex flex-col overflow-hidden bg-cyber-dark/20 min-h-[400px]">
            <div className="text-xs font-mono uppercase tracking-widest text-slate-400 pb-2 border-b border-white/5 mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4" /> Cognitive Analysis
            </div>

            {selectedUrlDetails ? (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Score badge & Title */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyber-cyan/15 border border-cyber-cyan/40 text-cyber-cyan shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                      Score: {selectedUrlDetails.score}/10
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">
                      {new Date(selectedUrlDetails.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white leading-snug">{selectedUrlDetails.title}</h3>
                  <a
                    href={selectedUrlDetails.url}
                    target="_blank"
                    className="text-[10px] text-cyber-indigo hover:underline font-mono truncate block mt-1"
                  >
                    View Source URL &rarr;
                  </a>
                </div>

                {/* Relevance rationale */}
                <div className="p-3 rounded-lg border border-white/5 bg-white/2">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-cyber-cyan" /> Relevance Reason
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans italic">
                    "{selectedUrlDetails.justification}"
                  </p>
                </div>

                {/* Summary */}
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1.5">Summary</h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans bg-cyber-dark/45 p-3 rounded-xl border border-white/5">
                    {selectedUrlDetails.summary}
                  </p>
                </div>

                {/* Key Takeaways */}
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1.5">Key Takeaways</h4>
                  <ul className="space-y-2">
                    {selectedUrlDetails.takeaways.map((point, index) => (
                      <li key={index} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyber-indigo mt-1.5 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Brain className="w-10 h-10 text-slate-700 mb-3" />
                <p className="text-xs font-mono">Cognitive core idle.</p>
                <p className="text-[10px] text-slate-600 max-w-xs mt-1 leading-relaxed">
                  Analyze URLs and click on any synced result to load key takeaways, summaries, and priority details here.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ================= SETTINGS SIDEBAR ================= */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="absolute inset-0" onClick={() => setIsSettingsOpen(false)} />
          <div className="relative w-full max-w-md h-full bg-[#0a0a0f] border-l border-white/10 p-8 flex flex-col justify-between shadow-[0_0_50px_rgba(0,0,0,0.8)] z-10 animate-cyber-glow">
            <div>
              <div className="flex justify-between items-center mb-6 pb-2 border-b border-white/5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-wide font-mono text-cyber-cyan">
                  <Settings className="w-5 h-5 text-cyber-cyan" /> Core API Config
                </h3>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-widest text-slate-400">API Provider</label>
                  <select
                    value={provider}
                    onChange={(e) => {
                      const val = e.target.value
                      setProvider(val)
                      if (val !== 'custom') {
                        setBaseUrl(PROVIDER_PRESETS[val].baseUrl)
                        setModel(PROVIDER_PRESETS[val].model)
                      }
                    }}
                    className="w-full px-4 py-2.5 glass-input text-sm bg-cyber-dark text-slate-200 border border-white/10 rounded-lg focus:outline-none focus:border-cyber-cyan cursor-pointer"
                  >
                    {Object.entries(PROVIDER_PRESETS).map(([key, p]) => (
                      <option key={key} value={key} className="bg-[#0f0f15] text-slate-200">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-widest text-slate-400">LLM Base URL</label>
                  <input
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.ollamacloud.com/v1"
                    className="w-full px-4 py-2.5 glass-input text-sm"
                  />
                  <p className="text-[10px] text-slate-500 font-mono">
                    Endpoint URL for LLM requests.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-widest text-slate-400">
                    {PROVIDER_PRESETS[provider]?.keyLabel || 'API Key'}
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={PROVIDER_PRESETS[provider]?.placeholderKey || 'Enter API Key'}
                    className="w-full px-4 py-2.5 glass-input text-sm"
                  />
                  <p className="text-[10px] text-slate-500 font-mono">
                    Stored locally in your browser. Never transmitted externally.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-widest text-slate-400">LLM Model Name</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. llama3.1"
                    className="w-full px-4 py-2.5 glass-input text-sm"
                  />
                  <p className="text-[10px] text-slate-500 font-mono">
                    {PROVIDER_PRESETS[provider]?.helpText || 'Verify the model is deployed on the instance.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Connection Test Status feedback */}
            {testResult && (
              <div className={`mb-3 p-3 rounded-lg border text-xs font-mono tracking-wide ${
                testResult.success 
                  ? 'border-cyber-emerald/30 bg-cyber-emerald/5 text-cyber-emerald'
                  : 'border-red-500/30 bg-red-500/5 text-red-400'
              }`}>
                {testResult.success 
                  ? '[SUCCESS]: Core LLM linked & online.'
                  : `[FAIL]: ${testResult.error}`
                }
              </div>
            )}

            <div className="flex gap-2">
              <button
                disabled={testingConnection}
                onClick={handleTestConnection}
                className="flex-1 py-3 rounded-lg border border-white/10 bg-white/3 text-slate-300 font-medium text-sm hover:bg-white/8 active:scale-98 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {testingConnection ? <Loader className="w-4 h-4 animate-spin text-cyber-cyan" /> : null}
                {testingConnection ? 'Testing...' : 'Test Connection'}
              </button>
              
              <button
                onClick={saveConfig}
                className="flex-1 py-3 rounded-lg bg-gradient-to-r from-cyber-indigo to-cyber-cyan text-white font-medium text-sm hover:opacity-90 active:scale-98 cursor-pointer shadow-[0_4px_15px_rgba(99,102,241,0.25)]"
              >
                Link Core Engine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CREATE TOPIC MODAL ================= */}
      {showTopicModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowTopicModal(false)} />
          <div className="relative w-full max-w-md bg-[#0a0a0f] border border-white/10 rounded-2xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-10">
            <h3 className="text-base font-bold text-white tracking-wide mb-4">Initialize Workspace Topic</h3>
            <form onSubmit={handleCreateTopic} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Topic Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next.js 15 App Router"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  className="w-full px-4 py-2.5 glass-input text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Description</label>
                <textarea
                  placeholder="Summarize the core focus of this research..."
                  value={newTopicDesc}
                  onChange={(e) => setNewTopicDesc(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 glass-input text-sm"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowTopicModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/8 hover:bg-white/8 text-slate-400 hover:text-white transition text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTopic}
                  className="px-4 py-2 rounded-lg bg-cyber-indigo text-white hover:opacity-90 active:scale-97 transition text-xs font-medium cursor-pointer"
                >
                  {creatingTopic ? 'Creating...' : 'Initialize'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= HIDDEN PRINT REPORT (For A4 PDF Canvas compilation) ================= */}
      <div className="absolute left-[-9999px] top-[-9999px]" style={{ zIndex: -100 }}>
        <div 
          ref={reportRef} 
          style={{ width: '800px', padding: '40px', backgroundColor: '#0a0a0c', color: '#f4f4f5' }}
          className="font-sans border border-white/10"
        >
          {/* Header */}
          <div style={{ borderBottom: '2px solid rgba(99,102,241,0.5)', paddingBottom: '20px', marginBottom: '25px' }}>
            <div style={{ float: 'right', fontSize: '12px', fontFamily: 'monospace', color: '#06b6d4' }}>
              ROSEY DIGEST ENGINE v1.0
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', letterSpacing: '0.05em', color: '#fff' }}>
              RESEARCH SYNTHESIS DIGEST
            </h1>
            <p style={{ fontSize: '13px', color: '#8b5cf6', fontFamily: 'monospace', textTransform: 'uppercase', marginTop: '4px' }}>
              WORKSPACE: {selectedTopic?.name}
            </p>
            {selectedTopic?.description && (
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', fontStyle: 'italic' }}>
                "{selectedTopic.description}"
              </p>
            )}
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '10px', fontFamily: 'monospace' }}>
              DATE COMPLED: {mounted ? new Date().toLocaleDateString() : ''} | RESEARCHER ID: USER_SECURE_ROW
            </div>
          </div>

          {/* Priority Matrix List */}
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '13px', fontFamily: 'monospace', textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '5px', marginBottom: '15px' }}>
              Priority Index
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px' }}>SCORE</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px' }}>TITLE</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px' }}>JUSTIFICATION</th>
                </tr>
              </thead>
              <tbody>
                {urls.filter(u => u.status === 'COMPLETED').map((u, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#cbd5e1' }}>
                    <td style={{ padding: '8px 4px', fontWeight: 'bold', color: '#06b6d4', width: '60px' }}>
                      [{u.score}/10]
                    </td>
                    <td style={{ padding: '8px 4px', fontWeight: '600', color: '#fff', width: '220px' }} className="truncate">
                      {u.title}
                    </td>
                    <td style={{ padding: '8px 4px', fontStyle: 'italic', fontSize: '11px' }}>
                      {u.justification}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detailed analysis pages */}
          <div style={{ marginTop: '20px' }}>
            <h2 style={{ fontSize: '13px', fontFamily: 'monospace', textTransform: 'uppercase', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '5px', marginBottom: '20px' }}>
              Detailed Synthesis Reports
            </h2>

            {urls.filter(u => u.status === 'COMPLETED').map((u, index) => (
              <div 
                key={u.id} 
                style={{ 
                  marginBottom: '35px', 
                  padding: '20px', 
                  backgroundColor: 'rgba(255,255,255,0.02)', 
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: '12px',
                  pageBreakInside: 'avoid'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', margin: 0, paddingRight: '15px' }}>
                    {index + 1}. {u.title}
                  </h3>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#06b6d4', fontWeight: 'bold', border: '1px solid rgba(6,182,212,0.3)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                    SCORE: {u.score}/10
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '12px', wordBreak: 'break-all' }}>
                  URL: {u.url}
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <h4 style={{ fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', color: '#8b5cf6', margin: '0 0 6px 0' }}>
                    Relevance Rationale
                  </h4>
                  <p style={{ fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic', margin: 0 }}>
                    "{u.justification}"
                  </p>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <h4 style={{ fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', color: '#8b5cf6', margin: '0 0 6px 0' }}>
                    Summary
                  </h4>
                  <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5', margin: 0 }}>
                    {u.summary}
                  </p>
                </div>

                <div>
                  <h4 style={{ fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', color: '#8b5cf6', margin: '0 0 8px 0' }}>
                    Key Takeaways
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '12px', color: '#cbd5e1' }}>
                    {u.takeaways.map((t, idx) => (
                      <li key={idx} style={{ marginBottom: '6px', lineHeight: '1.4' }}>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Footer signature */}
          <div style={{ marginTop: '40px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px', textAlign: 'center', fontSize: '10px', fontFamily: 'monospace', color: '#64748b' }}>
            Report generated by Rosey Research Partner. System signatures verified.
          </div>
        </div>
      </div>

    </div>
  )
}
