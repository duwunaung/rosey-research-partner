import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'

async function getAuthenticatedUser(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  if (!token) return null
  return verifyJWT(token)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    // Ensure the topic belongs to the user
    const topic = await db.topic.findFirst({
      where: { id, userId: user.userId },
    })

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    await db.topic.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Topic deleted successfully' })
  } catch (error) {
    console.error('Delete topic error:', error)
    return NextResponse.json({ error: 'Failed to delete topic' }, { status: 500 })
  }
}
