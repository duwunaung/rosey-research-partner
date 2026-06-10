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

    // 1. Fetch the URL item and ensure user owns the parent topic
    const urlItem = await db.watchedUrl.findFirst({
      where: {
        id: urlId,
        topic: {
          userId: user.userId,
        },
      },
    })

    if (!urlItem) {
      return NextResponse.json({ error: 'URL item not found or access denied' }, { status: 404 })
    }

    // Update status: SCRAPING
    await db.watchedUrl.update({
      where: { id: urlId },
      data: { status: 'SCRAPING' },
    })

    let scrapedMarkdown = ''
    let parsedTitle = urlItem.title || ''

    try {
      // 2. Call Jina Reader API to fetch and parse page content
      // Jina converts any URL to a clean LLM-friendly markdown format
      const scrapeUrl = `https://r.jina.ai/${urlItem.url}`
      
      const scrapeResponse = await fetch(scrapeUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/markdown',
        },
        // Set a 10-second timeout for scraping to prevent lockups
        signal: AbortSignal.timeout(10000),
      })

      if (!scrapeResponse.ok) {
        throw new Error(`Jina Reader scraping failed with status: ${scrapeResponse.status}`)
      }

      scrapedMarkdown = await scrapeResponse.text()

      // Simple extraction of title from Jina markdown header if available
      const titleMatch = scrapedMarkdown.match(/^Title:\s*(.*)$/m)
      if (titleMatch && titleMatch[1]) {
        parsedTitle = titleMatch[1].trim()
      }
    } catch (jinaError: any) {
      console.warn('Jina Reader failed or timed out. Initiating direct fetch fallback:', jinaError.message)
      
      try {
        // Fallback to direct HTTP fetch
        const directResponse = await fetch(urlItem.url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(8000), // 8-second timeout for direct fallback
        })

        if (!directResponse.ok) {
          throw new Error(`Direct fetch status: ${directResponse.status}`)
        }

        const html = await directResponse.text()

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        if (titleMatch && titleMatch[1]) {
          parsedTitle = titleMatch[1].trim().replace(/\s+/g, ' ')
        }

        // Clean HTML to text
        let cleanText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
          .replace(/<[^>]+>/g, ' ') // Strip remaining HTML tags
          .replace(/\s+/g, ' ')     // Normalize whitespaces
          .trim()

        scrapedMarkdown = `Title: ${parsedTitle}\n\nContent:\n${cleanText}`
      } catch (directError: any) {
        console.error('Direct fetch fallback also failed:', directError.message)
        
        await db.watchedUrl.update({
          where: { id: urlId },
          data: { status: 'FAILED' },
        })
        
        return NextResponse.json({ 
          error: `Scraping failed: Jina Timeout (${jinaError.message}) & Fallback Direct Fetch Failed (${directError.message})` 
        }, { status: 502 })
      }
    }

    // Update status: SUMMARIZING
    await db.watchedUrl.update({
      where: { id: urlId },
      data: { 
        status: 'SUMMARIZING',
        title: parsedTitle // Save title from scraper if found
      },
    })

    // 3. Connect to Ollama Cloud/OpenAI-compatible endpoint
    try {
      // Clean content to avoid exceeding token limit (max 12000 chars of source text)
      const sanitizedContent = scrapedMarkdown.slice(0, 12000)

      const systemPrompt = `You are Nexus Research Partner, a cybernetic research assistant.
Analyze the provided web page content and return a JSON object with the following fields:
- "title": A clean, descriptive title of the article/page (do not include markdown formatting). Use "${parsedTitle}" if it's already a good title.
- "summary": A concise, high-value summary of the page (3-4 sentences).
- "takeaways": An array of 3 to 5 core bullet points, each containing key facts, figures, or ideas. Keep them short and actionable.
- "score": A general relevance and information density score from 1 to 10 (integer). High score means the content has deep, unique insight or documentation value; low score means it is generic, clickbait, or has low utility.
- "justification": A 1-sentence explanation of why the content received this score.
- "publishedDate": The publication date of the page/article in YYYY-MM-DD format if found or can be confidently inferred. If not found, return null.

Your output MUST be a valid JSON object. Do not include markdown wraps like \`\`\`json or extra text outside the JSON structure. Just return raw JSON.`

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze the following webpage markdown:\n\n${sanitizedContent}` }
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
          temperature: 0.2,
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
        signal: AbortSignal.timeout(60000), // 60s timeout for LLM call
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

      // Clean up markdown wrapper blocks if returned by the LLM
      if (rawJsonText.startsWith('```json')) {
        rawJsonText = rawJsonText.replace(/^```json/, '').replace(/```$/, '').trim()
      } else if (rawJsonText.startsWith('```')) {
        rawJsonText = rawJsonText.replace(/^```/, '').replace(/```$/, '').trim()
      }

      const parsedResults = JSON.parse(rawJsonText)

      // 4. Update WatchedUrl in database with results and status: COMPLETED
      const updatedUrl = await db.watchedUrl.update({
        where: { id: urlId },
        data: {
          title: parsedResults.title || parsedTitle || urlItem.title,
          summary: parsedResults.summary || 'Summary unavailable.',
          takeaways: parsedResults.takeaways || [],
          score: Number(parsedResults.score) || 5,
          justification: parsedResults.justification || 'No justification provided.',
          publishedDate: parsedResults.publishedDate || null,
          status: 'COMPLETED',
        },
      })

      return NextResponse.json(updatedUrl)
    } catch (llmError: any) {
      console.error('LLM error:', llmError)
      await db.watchedUrl.update({
        where: { id: urlId },
        data: { status: 'FAILED' },
      })
      return NextResponse.json({ error: `AI summarization failed: ${llmError.message}` }, { status: 502 })
    }
  } catch (error: any) {
    console.error('Research API core error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
