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
    const userData = await db.user.findUnique({
      where: { id: user.userId },
      select: {
        username: true,
        provider: true,
        baseUrl: true,
        apiKey: true,
        model: true,
        confirmModel: true,
        llmConfigs: true,
      },
    })

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(userData)
  } catch (error: any) {
    console.error('Fetch user config error:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { provider, baseUrl, apiKey, model, confirmModel, llmConfigs } = await request.json()

    const updatedUser = await db.user.update({
      where: { id: user.userId },
      data: {
        provider,
        baseUrl,
        apiKey,
        model,
        confirmModel,
        llmConfigs,
      },
      select: {
        provider: true,
        baseUrl: true,
        apiKey: true,
        model: true,
        confirmModel: true,
        llmConfigs: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error: any) {
    console.error('Update user config error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
