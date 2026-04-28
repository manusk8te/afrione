'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit2, Save, X, Plus, TrendingUp, TrendingDown } from 'lucide-react'

const CATEGORIES = ['Plomberie', 'Électricité', 'Peinture', 'Maçonnerie', 'Menuiserie']

type Material = { id: string; name: string; unit: string; price: number; min: number; max: number; source: string; category: string; change: number }

const INIT_MATERIALS: Material[] = [
  { id: '1', name: 'Joint d\'étanchéité', unit: 'unité', price: 1500, min: 1200, max: 2000, source: 'Adjamé', category: 'Plomberie', change: 0 },
  { id: '2', name: 'Siphon PVC 32mm', unit: 'unité', price: 4500, min: 3500, max: 6000, source: 'Treichville', category: 'Plomberie', change: 5 },
  { id: '3', name: 'Tuyau PVC 20mm (m)', unit: 'mètre', price: 2800, min: 2200, max: 3500, source: 'Adjamé', category: 'Plomberie', change: -3 },
  { id: '4', name: 'Câble électrique 2.5mm (m)', unit: 'mètre', price: 1200, min: 900, max: 1500, source: 'Adjamé', category: 'Électricité', change: 8 },
  { id: '5', name: 'Disjoncteur 16A', unit: 'unité', price: 8500, min: 7000, max: 11000, source: 'Treichville', category: 'Électricité', change: 0 },
  { id: '6', name: 'Peinture intérieure (L)', unit: 'litre', price: 4200, min: 3500, max: 5500, source: 'Adjamé', category: 'Peinture', change: -2 },
  { id: '7', name: 'Enduit de lissage (kg)', unit: 'kg', price: 850, min: 700, max: 1100, source: 'Fournisseur', category: 'Peinture', change: 0 },
]

const LABOR_RATES = [
  { metier: 'Plombier', tarif: 6000, urgence: 50, nuit: 30, weekend: 20 },
  { metier: 'Électricien', tarif: 8000, urgence: 60, nuit: 30, weekend: 25 },
  { metier: 'Peintre', tarif: 4500, urgence: 30, nuit: 20, weekend: 15 },
  { metier: 'Maçon', tarif: 5500, urgence: 40, nuit: 25, weekend: 20 },
]

export default function AdminPrixPage() {
  const [materials, setMaterials] = useState<Material[]>(INIT_MATERIALS)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<Material>>({})
  const [activeCategory, setActiveCategory] = useState('Tous')

  const startEdit = (m: Material) => {
    setEditingId(m.id)
    setEditValues({ price: m.price, min: m.min, max: m.max })
  }

  const saveEdit = (id: string) => {
    setMaterials(ms => ms.map(m => m.id === id ? { ...m, ...editValues } : m))
    setEditingId(null)
  }

  const filtered = activeCategory === 'Tous' ? materials : materials.filter(m => m.category === activeCategory)

  return (
    <div className="min-h-screen bg-dark text-cream">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-56 bg-dark2 border-r border-border min-h-screen p-5 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center text-xs font-bold text-white">A</div>
            <span className="font-display font-bold">AFRIONE</span>
          </Link>
          <nav className="space-y-1">
            {[
              { href: '/admin', label: '📊 Vue d\'ensemble' },
              { href: '/admin/prix', label: '💰 Gestionnaire de prix', active: true },
              { href: '/admin/kyc', label: '🔍 Validation KYC' },
              { href: '/admin/litiges', label: '⚖️ Litiges' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  item.active ? 'bg-accent/20 text-accent' : 'text-muted hover:text-cream hover:bg-white/5'
                }`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/admin" className="p-1 hover:bg-white/10 rounded-lg transition-colors lg:hidden">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="font-display text-2xl font-bold text-cream">Gestionnaire de Prix</h1>
              <p className="text-muted text-sm mt-0.5">Matériaux · Taux horaires · Marges plateforme</p>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
            {['Tous', ...CATEGORIES].map(c => (
              <button key={c} onClick={() => setActiveCategory(c)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeCategory === c ? 'bg-accent text-white' : 'bg-dark2 text-muted hover:text-cream'
                }`}>
                {c}
              </button>
            ))}
          </div>

          {/* Materials table */}
          <div className="bg-dark2 rounded-2xl border border-border/30 overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <span className="font-mono text-xs text-muted uppercase tracking-wider">Prix Matériaux de Référence</span>
              <button className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors">
                <Plus size={12} /> Ajouter
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/20">
                    {['Matériau', 'Unité', 'Prix marché', 'Min', 'Max', 'Source', 'Variation', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.id} className="border-b border-border/10 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 font-medium text-cream">{m.name}</td>
                      <td className="px-4 py-3 text-muted font-mono text-xs">{m.unit}</td>
                      <td className="px-4 py-3">
                        {editingId === m.id ? (
                          <input type="number" value={editValues.price}
                            onChange={e => setEditValues(v => ({ ...v, price: parseInt(e.target.value) }))}
                            className="w-24 bg-dark border border-accent/50 rounded-lg px-2 py-1 text-cream text-xs focus:outline-none" />
                        ) : (
                          <span className="font-bold text-cream">{m.price.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === m.id ? (
                          <input type="number" value={editValues.min}
                            onChange={e => setEditValues(v => ({ ...v, min: parseInt(e.target.value) }))}
                            className="w-20 bg-dark border border-border/50 rounded-lg px-2 py-1 text-muted text-xs focus:outline-none" />
                        ) : (
                          <span className="text-muted">{m.min.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === m.id ? (
                          <input type="number" value={editValues.max}
                            onChange={e => setEditValues(v => ({ ...v, max: parseInt(e.target.value) }))}
                            className="w-20 bg-dark border border-border/50 rounded-lg px-2 py-1 text-muted text-xs focus:outline-none" />
                        ) : (
                          <span className="text-muted">{m.max.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-dark px-2 py-1 rounded-lg text-muted">{m.source}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs font-mono ${
                          m.change > 0 ? 'text-red-400' : m.change < 0 ? 'text-accent2' : 'text-muted'
                        }`}>
                          {m.change > 0 ? <TrendingUp size={12} /> : m.change < 0 ? <TrendingDown size={12} /> : null}
                          {m.change !== 0 ? `${m.change > 0 ? '+' : ''}${m.change}%` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {editingId === m.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(m.id)} className="p-1.5 bg-accent2/20 text-accent2 rounded-lg hover:bg-accent2/30 transition-colors">
                              <Save size={12} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 bg-white/10 text-muted rounded-lg hover:bg-white/20 transition-colors">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(m)} className="p-1.5 bg-white/5 text-muted rounded-lg hover:bg-white/10 hover:text-cream transition-colors">
                            <Edit2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Labor rates */}
          <div className="bg-dark2 rounded-2xl border border-border/30 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/30">
              <span className="font-mono text-xs text-muted uppercase tracking-wider">Taux Horaires par Métier</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/20">
                  {['Métier', 'Tarif/h', '+Urgence', '+Nuit', '+Weekend'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LABOR_RATES.map(r => (
                  <tr key={r.metier} className="border-b border-border/10 hover:bg-white/3">
                    <td className="px-4 py-3 font-medium text-cream">{r.metier}</td>
                    <td className="px-4 py-3 font-bold text-accent">{r.tarif.toLocaleString()} FCFA</td>
                    <td className="px-4 py-3 text-red-400 font-mono text-xs">+{r.urgence}%</td>
                    <td className="px-4 py-3 text-muted font-mono text-xs">+{r.nuit}%</td>
                    <td className="px-4 py-3 text-muted font-mono text-xs">+{r.weekend}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}
