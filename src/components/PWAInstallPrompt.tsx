'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err))
    }

    // Capture beforeinstallprompt event (Android / Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log(`PWA install choice outcome: ${outcome}`)
    setDeferredPrompt(null)
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm glass-panel border-cyber-cyan/35 bg-cyber-dark/95 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-[0_10px_35px_rgba(6,182,212,0.2)] animate-bounce-short">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan">
          <Download className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider">Install App</h4>
          <p className="text-[10px] text-slate-400 font-sans mt-0.5">Use Nexus on your Android phone</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 rounded-lg bg-cyber-cyan hover:opacity-90 text-black font-semibold text-[10px] uppercase font-mono tracking-wider transition cursor-pointer"
        >
          Install
        </button>
        <button
          onClick={() => setIsVisible(false)}
          className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
