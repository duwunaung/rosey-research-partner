import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'

async function getAuthenticatedUser(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  if (!token) return null
  return verifyJWT(token)
}

async function queryLLM({
  baseUrl,
  apiKey,
  model,
  messages,
  isOllamaNative
}: {
  baseUrl: string
  apiKey: string
  model: string
  messages: any[]
  isOllamaNative: boolean
}) {
  let llmUrl = ''
  let requestBody: any = {}

  if (isOllamaNative) {
    const baseEndpoint = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`
    llmUrl = `${baseEndpoint}/chat`
    requestBody = {
      model,
      messages,
      stream: false,
    }
  } else {
    let formattedBaseUrl = baseUrl
    if (!formattedBaseUrl.endsWith('/v1') && !formattedBaseUrl.endsWith('/api') && !formattedBaseUrl.includes('/v1/') && !formattedBaseUrl.includes('/api/')) {
      formattedBaseUrl = `${formattedBaseUrl}/v1`
    }
    llmUrl = `${formattedBaseUrl}/chat/completions`
    requestBody = {
      model,
      messages,
      temperature: 0.3,
    }
  }

  const llmHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) {
    llmHeaders['Authorization'] = `Bearer ${apiKey}`
  }

  const llmResponse = await fetch(llmUrl, {
    method: 'POST',
    headers: llmHeaders,
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(90000), // 90s timeout for synthesis
  })

  if (!llmResponse.ok) {
    throw new Error(`LLM returned status: ${llmResponse.status}`)
  }

  const llmData = await llmResponse.json()
  let content = ''

  if (isOllamaNative) {
    content = llmData.message?.content || ''
  } else {
    content = llmData.choices?.[0]?.message?.content || ''
  }

  return content.trim()
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { urlId, config } = await request.json()

    if (!urlId || !config) {
      return NextResponse.json({ error: 'Missing URL ID or configuration' }, { status: 400 })
    }

    const { baseUrl, apiKey, model } = config
    const cleanBaseUrl = baseUrl?.trim() || ''
    const cleanApiKey = apiKey?.trim() || ''
    const cleanModel = model?.trim() || ''

    if (!cleanBaseUrl || !cleanModel) {
      return NextResponse.json({ error: 'Missing LLM Base URL or Model configuration' }, { status: 400 })
    }

    // 1. Fetch parent URL item
    const urlItem = await db.watchedUrl.findFirst({
      where: {
        id: urlId,
        topic: {
          userId: user.userId,
        },
      },
    })

    if (!urlItem) {
      return NextResponse.json({ error: 'Parent URL not found or access denied' }, { status: 404 })
    }

    // 2. Fetch sub-sources
    const subSources = await db.watchedUrl.findMany({
      where: {
        parentId: urlId,
      },
    })

    if (subSources.length === 0) {
      return NextResponse.json({ error: 'No sub-sources found. Please initiate deep dive first' }, { status: 400 })
    }

    const completedSubSources = subSources.filter(s => s.status === 'COMPLETED')
    if (completedSubSources.length === 0) {
      return NextResponse.json({ error: 'No sub-sources have completed research yet. Please start research' }, { status: 400 })
    }

    // 3. Construct the prompt for the synthesis
    const systemPrompt = `You are a Cybernetic Research Synthesizer.
Compare and synthesize the research gathered from the parent source and its related sub-source citations.
Write a comprehensive, premium, and highly structured Markdown synthesis report.

Structure your report precisely with these headings:
# NEXUS DEEP-DIVE SYNTHESIS: [Parent Article Title]

## 1. EXECUTIVE METADATA & COMPARATIVE OVERVIEW
Write a high-quality comparison (4-5 sentences) summarizing the main concepts of the parent article versus what we discovered from the citations.

## 2. SUB-SOURCE COGNITIVE MESH
Go through each sub-source and describe its specific contributions, evidence, documentation, or facts added.

## 3. CONVERGENCE & DIVERGENCE (CROSS-EXAMINATION)
Analyze whether the sub-sources agree with, expand on, or contradict the parent article. Highlight any conflicts or gaps.

## 4. SYNTHESIZED SYSTEM TAKEAWAYS
Consolidate 4-6 high-value takeaways representing the combined insights of the entire mesh. Include statistics, code best practices, or architectural models if available.

Use clean Markdown formatting. Do not wrap the entire output in a markdown code block (\`\`\`markdown). Output raw Markdown text directly.`

    const parentBlock = `[PARENT URL SUMMARY]
Title: "${urlItem.title}"
URL: ${urlItem.url}
Score: ${urlItem.score}/10
Summary: ${urlItem.summary}
Takeaways:
${urlItem.takeaways.map(t => `- ${t}`).join('\n')}`

    const subsBlock = `[SUB-SOURCES SCRAPED]
${completedSubSources.map((s, idx) => `
Sub-source #${idx + 1}:
Title: "${s.title}"
URL: ${s.url}
Score: ${s.score}/10
Summary: ${s.summary}
Takeaways:
${s.takeaways.map(t => `- ${t}`).join('\n')}
`).join('\n')}`

    const userPrompt = `${parentBlock}\n\n${subsBlock}\n\nGenerate the comparative synthesis report.`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    const formattedBaseUrl = cleanBaseUrl.replace(/\/$/, '')
    const isOllamaNative = formattedBaseUrl.endsWith('/api') || formattedBaseUrl.includes('ollama.com')

    const reportContent = await queryLLM({
      baseUrl: formattedBaseUrl,
      apiKey: cleanApiKey,
      model: cleanModel,
      messages,
      isOllamaNative
    })

    // 4. Update the parent URL item in the database
    const updatedUrl = await db.watchedUrl.update({
      where: { id: urlId },
      data: {
        deepDiveReport: reportContent,
      },
    })

    return NextResponse.json(updatedUrl)

  } catch (error: any) {
    console.error('Deep-dive synthesis error:', error)
    return NextResponse.json({ error: `Failed to compile deep dive report: ${error.message}` }, { status: 500 })
  }
}
