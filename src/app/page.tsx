import Link from 'next/link'
import { cookies } from 'next/headers'
import { Shield, Brain, Terminal, FileText, ArrowRight, Activity } from 'lucide-react'

export default async function LandingPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const isLoggedIn = !!token

  return (
    <main className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden">
      {/* Background grids */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />

      {/* Cosmic glowing radial gradients */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-cyber-indigo/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-[500px] h-[500px] rounded-full bg-cyber-cyan/8 blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl glass-panel border-cyber-indigo/30 bg-cyber-dark/40">
            <Shield className="w-5 h-5 text-cyber-cyan" />
          </div>
          <span className="font-bold font-mono tracking-wider text-sm uppercase">Nexus Partner</span>
        </div>
        <Link 
          href="https://github.com/duwunaung/rosey-research-partner"
          target="_blank"
          className="p-2 rounded-lg glass-panel hover:border-cyber-indigo/50 hover:bg-white/5 transition duration-200 text-slate-400 hover:text-white"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
        </Link>
      </header>

      {/* Hero Section */}
      <section className="w-full max-w-5xl mx-auto px-6 py-20 flex flex-col items-center text-center z-10 my-auto">
        {/* Breathing system status label */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel border-cyber-cyan/30 bg-cyber-cyan/5 text-xs text-cyber-cyan mb-6 font-mono tracking-wider">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          SYSTEM OPERATIONAL: RESEARCH CORES ACTIVE
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent mb-6 max-w-4xl leading-tight">
          Your Intelligent Cybernetic <br />
          <span className="bg-gradient-to-r from-cyber-indigo via-cyber-purple to-cyber-cyan bg-clip-text text-transparent">
            Research Partner
          </span>
        </h1>

        <p className="text-base md:text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed font-sans">
          Automate the collection, summarization, and prioritization of your targeted research topics. Review contents, extract takeaways, and download offline PDF digests.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="px-8 py-3.5 rounded-lg bg-gradient-to-r from-cyber-indigo to-cyber-cyan hover:opacity-90 active:scale-98 transition text-white font-medium text-sm flex items-center gap-2 cursor-pointer shadow-[0_4px_20px_rgba(99,102,241,0.25)]"
            >
              Resume Research Session
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-8 py-3.5 rounded-lg bg-gradient-to-r from-cyber-indigo to-cyber-cyan hover:opacity-90 active:scale-98 transition text-white font-medium text-sm flex items-center gap-2 cursor-pointer shadow-[0_4px_20px_rgba(99,102,241,0.25)]"
              >
                Access Research Terminal
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="#features"
                className="px-8 py-3.5 rounded-lg glass-panel hover:bg-white/5 hover:border-cyber-indigo/40 active:scale-98 transition text-slate-300 font-medium text-sm"
              >
                Inspect Sub-Systems
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Subsystems/Features grid */}
      <section id="features" className="w-full max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-4 gap-6 z-10">
        <div className="glass-panel glass-panel-hover rounded-xl p-6 bg-cyber-dark/30">
          <div className="p-3 rounded-lg bg-cyber-indigo/10 border border-cyber-indigo/20 w-fit text-cyber-indigo mb-4">
            <Brain className="w-5 h-5 text-cyber-indigo" />
          </div>
          <h3 className="font-semibold text-white text-base mb-2">1. Ingest Targets</h3>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Add websites to watch or let AI suggest authoritative references based on your topic.
          </p>
        </div>

        <div className="glass-panel glass-panel-hover rounded-xl p-6 bg-cyber-dark/30">
          <div className="p-3 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 w-fit text-cyber-cyan mb-4">
            <Terminal className="w-5 h-5 text-cyber-cyan" />
          </div>
          <h3 className="font-semibold text-white text-base mb-2">2. Robotic Scraper</h3>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Extract clean, advertisement-free Markdown text from targets using the Jina Reader API.
          </p>
        </div>

        <div className="glass-panel glass-panel-hover rounded-xl p-6 bg-cyber-dark/30">
          <div className="p-3 rounded-lg bg-cyber-purple/10 border border-cyber-purple/20 w-fit text-cyber-purple mb-4">
            <Shield className="w-5 h-5 text-cyber-purple" />
          </div>
          <h3 className="font-semibold text-white text-base mb-2">3. Cybernetic Ranker</h3>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Analyze topics via advanced LLMs. Sort and prioritize findings by general relevance score.
          </p>
        </div>

        <div className="glass-panel glass-panel-hover rounded-xl p-6 bg-cyber-dark/30">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 w-fit text-emerald-400 mb-4">
            <FileText className="w-5 h-5 text-emerald-400" />
          </div>
          <h3 className="font-semibold text-white text-base mb-2">4. PDF Digest</h3>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Compile priorities, justifications, and takeaways into a beautifully formatted offline PDF.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 z-10 text-xs text-slate-500 font-mono">
        <span>&copy; 2026 Nexus Research Partner. All rights reserved.</span>
        <div className="flex gap-4">
          <span>Nexus Research Partner v1.5.2</span>
          <span>&middot;</span>
          <span>MIT License</span>
        </div>
      </footer>
    </main>
  )
}
