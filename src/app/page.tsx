
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex justify-between items-end border-b border-indigo-900/50 pb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter text-white mb-2">PROVENIQ <span className="text-indigo-500">PROTECT</span></h1>
            <p className="text-slate-400 text-sm tracking-widest uppercase">The Shield // Algorithmic Risk MGA</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 font-mono">RISK ENGINE</div>
            <div className="text-indigo-400 font-bold flex items-center justify-end gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              CALCULATING
            </div>
          </div>
        </header>

        {/* Feature Component */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          <div className="space-y-8">
            <h2 className="text-3xl font-light text-white leading-tight">
              Dynamic premiums powered by <br />
              <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">real-time asset truth.</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              We don't guess. We verify. Our pricing engine reads directly from the Proveniq Ledger to adjust premiums based on verifiably true data.
            </p>

            <div className="flex gap-4">
              <div className="flex-1 bg-slate-900 border border-slate-800 p-4 rounded-lg">
                <div className="text-3xl font-mono text-white mb-1">10 <span className="text-sm text-slate-500">BPS</span></div>
                <div className="text-xs text-indigo-400 tracking-wider">BASE RATE</div>
              </div>
              <div className="flex-1 bg-slate-900 border border-slate-800 p-4 rounded-lg">
                <div className="text-3xl font-mono text-white mb-1">-15%</div>
                <div className="text-xs text-emerald-400 tracking-wider">VERIFIED DISCOUNT</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-indigo-500/20 p-8 rounded-2xl shadow-2xl shadow-indigo-900/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>

            <h3 className="text-xl font-bold text-white mb-6">Instant Dynamic Quote</h3>
            <form className="space-y-4 relative z-10">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2">Asset ID</label>
                <input type="text" placeholder="UUID like 7f8c..." className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2">Coverage Tier</label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" className="py-2 text-sm bg-indigo-600/20 border border-indigo-500 text-white rounded font-medium">Full Spec</button>
                  <button type="button" className="py-2 text-sm bg-slate-950 border border-slate-700 text-slate-400 rounded hover:border-slate-500">Transit</button>
                  <button type="button" className="py-2 text-sm bg-slate-950 border border-slate-700 text-slate-400 rounded hover:border-slate-500">Storage</button>
                </div>
              </div>

              <div className="pt-4">
                <button className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-lg shadow-lg shadow-indigo-900/30 transition-all flex justify-center items-center gap-2">
                  <span>CALCULATE PREMIUM</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </form>

            <div className="mt-6 text-center text-xs text-slate-500">
              Secured by Ed25519 Signatures & Ledger V1
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
