import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword, signJWT } from '@/lib/auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params

  try {
    if (action === 'register') {
      const { email, username, password } = await request.json()

      if (!email || !username || !password) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      // Check if user exists
      const existingUser = await db.user.findFirst({
        where: {
          OR: [{ email }, { username }],
        },
      })

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email or username already registered' },
          { status: 409 }
        )
      }

      // Hash password and save user
      const hashedPassword = await hashPassword(password)
      const user = await db.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
        },
      })

      return NextResponse.json({
        message: 'Registration successful',
        user: { id: user.id, email: user.email, username: user.username },
      })
    }

    if (action === 'login') {
      const { identifier, password } = await request.json() // identifier can be username or email

      if (!identifier || !password) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      // Find user
      const user = await db.user.findFirst({
        where: {
          OR: [{ email: identifier }, { username: identifier }],
        },
      })

      if (!user) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      // Verify password
      const isValid = await verifyPassword(password, user.password)
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      // Sign JWT
      const token = await signJWT({
        userId: user.id,
        email: user.email,
        username: user.username,
      })

      // Set cookie
      const response = NextResponse.json({
        message: 'Login successful',
        user: { id: user.id, email: user.email, username: user.username },
      })

      response.cookies.set({
        name: 'token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      })

      return response
    }

    if (action === 'logout') {
      const response = NextResponse.json({ message: 'Logged out successfully' })
      response.cookies.delete('token')
      return response
    }

    return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  } catch (error: any) {
    console.error('Auth API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
