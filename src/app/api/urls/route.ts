import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'

async function getAuthenticatedUser(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  if (!token) return null
  return verifyJWT(token)
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const topicId = searchParams.get('topicId')

  if (!topicId) {
    return NextResponse.json({ error: 'Topic ID is required' }, { status: 400 })
  }

  try {
    // Verify topic ownership
    const topic = await db.topic.findFirst({
      where: { id: topicId, userId: user.userId },
    })

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found or access denied' }, { status: 404 })
    }

    const urls = await db.watchedUrl.findMany({
      where: { topicId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(urls)
  } catch (error) {
    console.error('Fetch URLs error:', error)
    return NextResponse.json({ error: 'Failed to fetch URLs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { url, topicId, parentId, justification } = await request.json()

    if (!url || !topicId) {
      return NextResponse.json({ error: 'URL and Topic ID are required' }, { status: 400 })
    }

    // Verify URL structure
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Verify topic ownership
    const topic = await db.topic.findFirst({
      where: { id: topicId, userId: user.userId },
    })

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found or access denied' }, { status: 404 })
    }

    // Extract domain as a default title placeholder
    const domain = new URL(url).hostname.replace('www.', '')

    const watchedUrl = await db.watchedUrl.create({
      data: {
        url,
        title: domain, // Initial placeholder title
        status: 'PENDING',
        topicId,
        parentId: parentId || null,
        justification: justification || null,
      },
    })

    return NextResponse.json(watchedUrl)
  } catch (error) {
    console.error('Add URL error:', error)
    return NextResponse.json({ error: 'Failed to add URL' }, { status: 500 })
  }
}
