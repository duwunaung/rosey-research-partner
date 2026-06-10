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
    // Ensure the URL belongs to a topic owned by the user
    const urlItem = await db.watchedUrl.findFirst({
      where: {
        id,
        topic: {
          userId: user.userId,
        },
      },
    })

    if (!urlItem) {
      return NextResponse.json({ error: 'URL item not found or access denied' }, { status: 404 })
    }

    await db.watchedUrl.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'URL deleted successfully' })
  } catch (error) {
    console.error('Delete URL error:', error)
    return NextResponse.json({ error: 'Failed to delete URL' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const { notes, revisit } = await request.json()

    // Ensure the URL belongs to a topic owned by the user
    const urlItem = await db.watchedUrl.findFirst({
      where: {
        id,
        topic: {
          userId: user.userId,
        },
      },
    })

    if (!urlItem) {
      return NextResponse.json({ error: 'URL item not found or access denied' }, { status: 404 })
    }

    const updatedData: any = {}
    if (notes !== undefined) updatedData.notes = notes
    if (revisit !== undefined) updatedData.revisit = revisit

    const updatedUrl = await db.watchedUrl.update({
      where: { id },
      data: updatedData,
    })

    return NextResponse.json(updatedUrl)
  } catch (error) {
    console.error('Update URL error:', error)
    return NextResponse.json({ error: 'Failed to update URL' }, { status: 500 })
  }
}
