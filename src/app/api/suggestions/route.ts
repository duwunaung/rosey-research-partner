import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'

async function getAuthenticatedUser(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  if (!token) return null
  return verifyJWT(token)
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { topicId, config, timeHorizon } = await request.json()

    if (!topicId || !config) {
      return NextResponse.json({ error: 'Missing Topic ID or configuration' }, { status: 400 })
    }

    const { baseUrl, apiKey, model } = config
    const cleanBaseUrl = baseUrl?.trim() || ''
    const cleanApiKey = apiKey?.trim() || ''
    const cleanModel = model?.trim() || ''

    if (!cleanBaseUrl || !cleanModel) {
      return NextResponse.json({ error: 'Missing LLM Base URL or Model configuration' }, { status: 400 })
    }

    // Ensure user owns the topic
    const topic = await db.topic.findFirst({
      where: { id: topicId, userId: user.userId },
    })

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found or access denied' }, { status: 404 })
    }

    const cleanTimeHorizon = timeHorizon === 'year' ? 'past 1 year' : (timeHorizon === 'all' ? 'all-time archive (no limit)' : 'past 1 month (recent)');

    // Prompt the LLM to generate recommendations based on the topic
    const systemPrompt = `You are a cybernetic web intelligence crawler.
Given a research topic, recommend exactly 5 to 7 high-authority, popular, and active website URLs (such as official docs, top developer blogs, academic hubs, or news channels) that are highly relevant.
Ensure all recommended resources are published or actively updated within the following time horizon constraint: ${cleanTimeHorizon}. Avoid outdated, obsolete, or broken URLs.
Your output MUST be a valid JSON array of objects, where each object contains:
- "name": A descriptive name of the resource (e.g., "Next.js 15 Blog" or "Mozilla Developer Network").
- "url": The exact, valid HTTPS URL to the resource or page.

Do not write markdown tags like \`\`\`json or add extra conversations. Just return a clean, raw JSON array.`

    const userPrompt = `Topic Name: "${topic.name}"\nDescription: "${topic.description || 'No description provided.'}"\n\nRecommend 5-7 popular resources now.`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    let formattedBaseUrl = cleanBaseUrl.replace(/\/$/, '')
    const isOllamaNative = formattedBaseUrl.endsWith('/api') || formattedBaseUrl.includes('ollama.com')
    
    let llmUrl = ''
    let requestBody: any = {}

    if (isOllamaNative) {
      const baseEndpoint = formattedBaseUrl.endsWith('/api') ? formattedBaseUrl : `${formattedBaseUrl}/api`
      llmUrl = `${baseEndpoint}/chat`
      requestBody = {
        model: cleanModel,
        messages: messages,
        stream: false,
        format: 'json',
      }
    } else {
      if (!formattedBaseUrl.endsWith('/v1') && !formattedBaseUrl.endsWith('/api') && !formattedBaseUrl.includes('/v1/') && !formattedBaseUrl.includes('/api/')) {
        formattedBaseUrl = `${formattedBaseUrl}/v1`
      }
      llmUrl = `${formattedBaseUrl}/chat/completions`
      requestBody = {
        model: cleanModel,
        messages: messages,
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }
    }
    
    const llmHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (cleanApiKey) {
      llmHeaders['Authorization'] = `Bearer ${cleanApiKey}`
    }

    const llmResponse = await fetch(llmUrl, {
      method: 'POST',
      headers: llmHeaders,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000), // 30s timeout
    })

    if (!llmResponse.ok) {
      throw new Error(`LLM endpoint returned status: ${llmResponse.status}`)
    }

    const llmData = await llmResponse.json()
    let rawJsonText = ''

    if (isOllamaNative) {
      rawJsonText = llmData.message?.content?.trim() || ''
    } else {
      rawJsonText = llmData.choices?.[0]?.message?.content?.trim() || ''
    }

    // Clean up markdown block wraps
    if (rawJsonText.startsWith('```json')) {
      rawJsonText = rawJsonText.replace(/^```json/, '').replace(/```$/, '').trim()
    } else if (rawJsonText.startsWith('```')) {
      rawJsonText = rawJsonText.replace(/^```/, '').replace(/```$/, '').trim()
    }

    const recommendations = JSON.parse(rawJsonText)

    return NextResponse.json(recommendations)
  } catch (error: any) {
    console.error('Suggestions API error:', error)
    return NextResponse.json({ error: `Failed to generate recommendations: ${error.message}` }, { status: 500 })
  }
}
