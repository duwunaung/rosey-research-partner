import { NextRequest, NextResponse } from 'next/server'
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
    const { config } = await request.json()
    if (!config) {
      return NextResponse.json({ error: 'Missing configuration' }, { status: 400 })
    }

    const { baseUrl, apiKey, model } = config
    if (!baseUrl || !model) {
      return NextResponse.json({ error: 'Missing URL or Model name' }, { status: 400 })
    }

    let formattedBaseUrl = baseUrl.replace(/\/$/, '')
    const isOllamaNative = formattedBaseUrl.endsWith('/api') || formattedBaseUrl.includes('ollama.com')

    let llmUrl = ''
    let requestBody: any = {}
    const messages = [{ role: 'user', content: 'Say OK' }]

    if (isOllamaNative) {
      const baseEndpoint = formattedBaseUrl.endsWith('/api') ? formattedBaseUrl : `${formattedBaseUrl}/api`
      llmUrl = `${baseEndpoint}/chat`
      requestBody = {
        model: model,
        messages: messages,
        stream: false,
      }
    } else {
      if (!formattedBaseUrl.endsWith('/v1') && !formattedBaseUrl.endsWith('/api') && !formattedBaseUrl.includes('/v1/') && !formattedBaseUrl.includes('/api/')) {
        formattedBaseUrl = `${formattedBaseUrl}/v1`
      }
      llmUrl = `${formattedBaseUrl}/chat/completions`
      requestBody = {
        model: model,
        messages: messages,
        max_tokens: 5,
      }
    }

    const llmHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      llmHeaders['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(llmUrl, {
      method: 'POST',
      headers: llmHeaders,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000), // 10s timeout for testing
    })

    if (!response.ok) {
      return NextResponse.json({ success: false, error: `Server returned status: ${response.status}` })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
