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
      format: 'json',
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
      response_format: { type: 'json_object' },
      temperature: 0.2,
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
    signal: AbortSignal.timeout(60000), // 60s timeout
  })

  if (!llmResponse.ok) {
    throw new Error(`LLM returned status: ${llmResponse.status}`)
  }

  const llmData = await llmResponse.json()
  let rawJsonText = ''

  if (isOllamaNative) {
    rawJsonText = llmData.message?.content?.trim() || ''
  } else {
    rawJsonText = llmData.choices?.[0]?.message?.content?.trim() || ''
  }

  if (rawJsonText.startsWith('```json')) {
    rawJsonText = rawJsonText.replace(/^```json/, '').replace(/```$/, '').trim()
  } else if (rawJsonText.startsWith('```')) {
    rawJsonText = rawJsonText.replace(/^```/, '').replace(/```$/, '').trim()
  }

  return JSON.parse(rawJsonText)
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

    // 1. Fetch the parent URL item and verify ownership
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

    if (urlItem.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Deep-dive can only be initiated on successfully completed research items' }, { status: 400 })
    }

    // 2. Formulate LLM prompt to discover reference URLs
    const systemPrompt = `You are a cybernetic Deep-Dive Research Agent.
Analyze the provided article metadata (Title, Summary, Takeaways).
Your job is to recommend 2 to 3 highly authoritative reference URLs (e.g., official docs, research papers, GitHub repositories) that would help cross-reference, expand, or investigate the core claims and sub-concepts in this article.
If you don't know the exact real URLs, construct realistic reference URLs targeting official domains (e.g., react.dev, developer.mozilla.org, arxiv.org, github.com, web.dev) that discuss these specific sub-concepts.

Output a JSON object with a "references" field containing an array of objects. Each object MUST have:
- "url": The complete URL of the reference.
- "title": A brief descriptive title of the reference.
- "reason": A short explanation (1 sentence) of why this reference is relevant to the parent article.

Your output MUST be a valid JSON object. Do not include markdown wraps or extra text outside the JSON structure. Just return raw JSON.`

    const userPrompt = `Parent Article Title: "${urlItem.title}"
Parent Summary: "${urlItem.summary}"
Key Takeaways:
${urlItem.takeaways.map((t: string) => `- ${t}`).join('\n')}

Identify 2 to 3 reference URLs.`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    const formattedBaseUrl = cleanBaseUrl.replace(/\/$/, '')
    const isOllamaNative = formattedBaseUrl.endsWith('/api') || formattedBaseUrl.includes('ollama.com')

    const response = await queryLLM({
      baseUrl: formattedBaseUrl,
      apiKey: cleanApiKey,
      model: cleanModel,
      messages,
      isOllamaNative
    })

    const references = response.references || []
    const createdUrls = []

    // 3. Create sub-source URL items in the database
    for (const ref of references) {
      if (!ref.url) continue
      try {
        new URL(ref.url)
      } catch {
        continue // Skip invalid URLs
      }

      // Check if URL already exists in this topic
      const existing = await db.watchedUrl.findFirst({
        where: {
          topicId: urlItem.topicId,
          url: ref.url
        }
      })

      if (existing) continue

      const newUrl = await db.watchedUrl.create({
        data: {
          url: ref.url,
          title: ref.title || new URL(ref.url).hostname.replace('www.', ''),
          status: 'PENDING',
          topicId: urlItem.topicId,
          parentId: urlItem.id,
          justification: `[DEEP DIVE SUB-SOURCE]: ${ref.reason || 'Expansion of parent topics.'}`,
        }
      })
      createdUrls.push(newUrl)
    }

    return NextResponse.json({
      message: `Discovered ${createdUrls.length} sub-sources for deep-dive.`,
      subSources: createdUrls
    })

  } catch (error: any) {
    console.error('Deep-dive initiate error:', error)
    return NextResponse.json({ error: `Failed to initiate deep dive: ${error.message}` }, { status: 500 })
  }
}
