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

  try {
    const topics = await db.topic.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { urls: true }
        }
      }
    })
    return NextResponse.json(topics)
  } catch (error) {
    console.error('Fetch topics error:', error)
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name, description } = await request.json()
    if (!name) {
      return NextResponse.json({ error: 'Topic name is required' }, { status: 400 })
    }

    const topic = await db.topic.create({
      data: {
        name,
        description,
        userId: user.userId,
      },
    })

    return NextResponse.json(topic)
  } catch (error) {
    console.error('Create topic error:', error)
    return NextResponse.json({ error: 'Failed to create topic' }, { status: 500 })
  }
}
