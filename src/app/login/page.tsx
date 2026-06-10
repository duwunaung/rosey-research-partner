'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Mail, Lock, User, ArrowRight, Loader } from 'lucide-react'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [identifier, setIdentifier] = useState('') // Username or Email for login
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      setSuccess('Registration successful! Flipping to Login...')
      // Clean up fields
      setEmail('')
      setUsername('')
      setPassword('')
      
      // Delay to allow user to see success before flip
      setTimeout(() => {
        setIsLogin(true)
        setSuccess('')
      }, 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Login failed')
      }

      setSuccess('Authorization granted. Booting system...')
      
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 1000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden">
      {/* Background cyber grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Decorative glowing backdrops */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-cyber-indigo/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-cyber-cyan/10 blur-[120px] pointer-events-none" />

      {/* 3D Flip Card Container */}
      <div className="w-full max-w-md perspective-1000 z-10">
        
        {/* Logo / Header */}
        <div className="flex flex-col items-center mb-8 text-center animate-float">
          <div className="p-3 rounded-2xl glass-panel border border-cyber-indigo/30 shadow-[0_0_15px_rgba(99,102,241,0.2)] mb-3 bg-cyber-dark">
            <Shield className="w-8 h-8 text-cyber-cyan" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            NEXUS RESEARCH PARTNER
          </h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-mono">
            Cybernetic Ingestion & Synthesis Engine
          </p>
        </div>

        {/* The Card */}
        <div 
          className={`relative w-full h-[470px] transform-style-3d transition-transform duration-700 ${
            isLogin ? '' : 'rotate-y-180'
          }`}
        >
          {/* ================= FRONT SIDE (LOGIN) ================= */}
          <div className="absolute inset-0 w-full h-full backface-hidden glass-panel rounded-2xl p-8 flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-white/10">
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white tracking-wide">Access Terminal</h2>
                <span className="text-xs font-mono px-2 py-0.5 rounded border border-cyber-indigo/20 text-cyber-indigo bg-cyber-indigo/5">SECURE</span>
              </div>

              {error && (
                <div className="mb-4 text-xs font-mono p-3 rounded border border-red-500/30 text-red-400 bg-red-500/5 terminal-glow animate-pulse">
                  [SYSTEM ERROR]: {error}
                </div>
              )}

              {success && (
                <div className="mb-4 text-xs font-mono p-3 rounded border border-cyber-cyan/30 text-cyber-cyan bg-cyber-cyan/5 terminal-glow">
                  [OK]: {success}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Identifier (Username/Email)</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. researcher"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 glass-input text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Pass-Key</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 glass-input text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 rounded-lg bg-gradient-to-r from-cyber-indigo to-cyber-cyan hover:opacity-90 active:scale-98 transition text-white font-medium text-sm flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_15px_rgba(99,102,241,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      Verify Signature
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="text-center mt-4">
              <p className="text-xs text-slate-500">
                New researcher?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false)
                    setError('')
                  }}
                  className="text-cyber-cyan hover:underline font-medium cursor-pointer"
                >
                  Register Profile
                </button>
              </p>
            </div>
          </div>

          {/* ================= BACK SIDE (REGISTER) ================= */}
          <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 glass-panel rounded-2xl p-8 flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-white/10">
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white tracking-wide">Register Profile</h2>
                <span className="text-xs font-mono px-2 py-0.5 rounded border border-cyber-purple/20 text-cyber-purple bg-cyber-purple/5">NEW ROW</span>
              </div>

              {error && (
                <div className="mb-4 text-xs font-mono p-3 rounded border border-red-500/30 text-red-400 bg-red-500/5 terminal-glow animate-pulse">
                  [SYSTEM ERROR]: {error}
                </div>
              )}

              {success && (
                <div className="mb-4 text-xs font-mono p-3 rounded border border-cyber-cyan/30 text-cyber-cyan bg-cyber-cyan/5 terminal-glow">
                  [OK]: {success}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="researcher"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 glass-input text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="user@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 glass-input text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-widest text-slate-400">Pass-Key</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 glass-input text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 rounded-lg bg-gradient-to-r from-cyber-purple to-cyber-indigo hover:opacity-90 active:scale-98 transition text-white font-medium text-sm flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_15px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      Initialize Core
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="text-center mt-4">
              <p className="text-xs text-slate-500">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true)
                    setError('')
                  }}
                  className="text-cyber-purple hover:underline font-medium cursor-pointer"
                >
                  Access Terminal
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
