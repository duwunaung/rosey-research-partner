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

    const { baseUrl, apiKey, model, confirmModel } = config
    const cleanBaseUrl = baseUrl?.trim() || ''
    const cleanApiKey = apiKey?.trim() || ''
    const cleanModel = model?.trim() || ''
    const cleanConfirmModel = confirmModel?.trim() || ''

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
      const scrapeUrl = `https://r.jina.ai/${urlItem.url}`
      
      const scrapeResponse = await fetch(scrapeUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/markdown',
        },
        signal: AbortSignal.timeout(25000),
      })

      if (!scrapeResponse.ok) {
        throw new Error(`Jina Reader scraping failed with status: ${scrapeResponse.status}`)
      }

      scrapedMarkdown = await scrapeResponse.text()

      const titleMatch = scrapedMarkdown.match(/^Title:\s*(.*)$/m)
      if (titleMatch && titleMatch[1]) {
        parsedTitle = titleMatch[1].trim()
      }
    } catch (jinaError: any) {
      console.warn('Jina Reader failed. Direct fetch fallback:', jinaError.message)
      
      try {
        const directResponse = await fetch(urlItem.url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(20000),
        })

        if (!directResponse.ok) {
          throw new Error(`Direct fetch status: ${directResponse.status}`)
        }

        const html = await directResponse.text()
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        if (titleMatch && titleMatch[1]) {
          parsedTitle = titleMatch[1].trim().replace(/\s+/g, ' ')
        }

        let cleanText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        scrapedMarkdown = `Title: ${parsedTitle}\n\nContent:\n${cleanText}`
      } catch (directError: any) {
        await db.watchedUrl.update({
          where: { id: urlId },
          data: { status: 'FAILED' },
        })
        
        return NextResponse.json({ 
          error: `Scraping failed: Jina (${jinaError.message}) & Fallback (${directError.message})` 
        }, { status: 502 })
      }
    }

    // Update status: SUMMARIZING
    await db.watchedUrl.update({
      where: { id: urlId },
      data: { 
        status: 'SUMMARIZING',
        title: parsedTitle
      },
    })

    // 3. Connect to Ollama/OpenAI-compatible endpoint
    try {
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
      
      // Call primary model
      const parsedResults = await queryLLM({
        baseUrl: formattedBaseUrl,
        apiKey: cleanApiKey,
        model: cleanModel,
        messages,
        isOllamaNative
      })

      // Optional secondary validation model
      if (cleanConfirmModel) {
        const confirmSystemPrompt = `You are Nexus Verification Engine, a cybernetic validation agent.
Review the following research summary, takeaways, and score generated by our primary model, and cross-reference them with the original webpage content snippet.
Determine whether this research summary and relevance score are accurate, and decide whether to APPROVE or DENY/REJECT the search item.

If you approve, return:
{
  "approved": true,
  "reason": "Brief reason for approval"
}

If you deny/reject (e.g., if the content is irrelevant to the topic, spam, low quality, or the summary/score is incorrect), return:
{
  "approved": false,
  "reason": "Detailed reason for rejection"
}

Your response MUST be a valid JSON object. Do not include markdown wraps or extra text. Just return raw JSON.`

        const confirmMessages = [
          { role: 'system', content: confirmSystemPrompt },
          { role: 'user', content: `Original Webpage Content Snippet:\n${sanitizedContent}\n\nGenerated Summary:\n${parsedResults.summary}\n\nGenerated Takeaways:\n${parsedResults.takeaways?.join('\n')}\n\nGenerated Score: ${parsedResults.score}/10` }
        ]

        try {
          const confirmation = await queryLLM({
            baseUrl: formattedBaseUrl,
            apiKey: cleanApiKey,
            model: cleanConfirmModel,
            messages: confirmMessages,
            isOllamaNative
          })

          if (confirmation.approved === false) {
            // Rejected! Save status as FAILED and prefix justification with rejection details
            const updatedUrl = await db.watchedUrl.update({
              where: { id: urlId },
              data: {
                title: parsedResults.title || parsedTitle || urlItem.title,
                summary: parsedResults.summary || 'Summary unavailable.',
                takeaways: parsedResults.takeaways || [],
                score: Number(parsedResults.score) || 5,
                justification: `[REJECTED BY CONFIRMING CORE]: ${confirmation.reason || 'Verification rejected.'}`,
                publishedDate: parsedResults.publishedDate || null,
                status: 'FAILED',
              },
            })
            return NextResponse.json(updatedUrl)
          }
        } catch (confirmError: any) {
          console.warn('Confirming model validation failed:', confirmError.message)
          const updatedUrl = await db.watchedUrl.update({
            where: { id: urlId },
            data: {
              title: parsedResults.title || parsedTitle || urlItem.title,
              summary: parsedResults.summary || 'Summary unavailable.',
              takeaways: parsedResults.takeaways || [],
              score: Number(parsedResults.score) || 5,
              justification: `[CONFIRMING ERROR]: Validation failed to run (${confirmError.message})`,
              publishedDate: parsedResults.publishedDate || null,
              status: 'FAILED',
            },
          })
          return NextResponse.json(updatedUrl)
        }
      }

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
