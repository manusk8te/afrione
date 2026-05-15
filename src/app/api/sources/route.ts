/**
 * API /api/sources — base collaborative de sources de prix matériaux
 *
 * Types de sources :
 *   - website : site e-commerce scrappable (ex: Jumia, CasaShop)
 *   - magasin : boutique physique à Abidjan ajoutée par un artisan
 *
 * SQL à exécuter dans Supabase une seule fois :
 *
 *   CREATE TABLE IF NOT EXISTS price_sources (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     name text NOT NULL,
 *     type text NOT NULL CHECK (type IN ('website', 'magasin')),
 *     url text,
 *     quartier text,
 *     gps_lat double precision,
 *     gps_lng double precision,
 *     added_by uuid REFERENCES users(id),
 *     verified boolean DEFAULT false,
 *     scraper_type text DEFAULT 'jumia',
 *     notes text,
 *     created_at timestamptz DEFAULT now()
 *   );
 *
 *   ALTER TABLE price_materials
 *     ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES price_sources(id),
 *     ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES users(id),
 *     ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ── GET /api/sources?type=website|magasin|all ─────────────────────────────────
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') ?? 'all'
  const sourceId = req.nextUrl.searchParams.get('source_id')

  // Liste les matériaux d'une source spécifique
  if (sourceId) {
    const { data, error } = await supabaseAdmin
      .from('price_materials')
      .select('id,name,category,unit,tier,price_market,price_min,price_max,web_price,brand,photo_url,source_url,added_by,confirmed_at,last_scraped_at')
      .eq('source_id', sourceId)
      .order('category')
      .order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  // Liste les sources
  let query = supabaseAdmin
    .from('price_sources')
    .select('*')
    .order('verified', { ascending: false })
    .order('created_at', { ascending: false })

  if (type !== 'all') query = query.eq('type', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// ── POST /api/sources ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body

  // ── Ajouter une source (admin: website | artisan: magasin) ────────────────
  if (action === 'add_source') {
    const { name, type, url, quartier, gps_lat, gps_lng, notes, scraper_type, added_by } = body

    if (!name || !type) return NextResponse.json({ error: 'name et type requis' }, { status: 400 })
    if (!['website', 'magasin'].includes(type)) return NextResponse.json({ error: 'type invalide' }, { status: 400 })
    if (type === 'website' && !url) return NextResponse.json({ error: 'url requise pour un site web' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('price_sources')
      .insert({
        name,
        type,
        url: url || null,
        quartier: quartier || null,
        gps_lat: gps_lat || null,
        gps_lng: gps_lng || null,
        notes: notes || null,
        scraper_type: scraper_type || (type === 'website' ? 'jumia' : 'manual'),
        added_by: added_by || null,
        verified: type === 'website', // les sites web sont auto-vérifiés par l'admin
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, source: data })
  }

  // ── Vérifier un magasin (admin uniquement) ────────────────────────────────
  if (action === 'verify_source') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('price_sources')
      .update({ verified: true })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── Supprimer une source (admin uniquement) ───────────────────────────────
  if (action === 'delete_source') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await supabaseAdmin.from('price_sources').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── Ajouter un article à une source (artisan) ─────────────────────────────
  if (action === 'add_material') {
    const { source_id, name, category, unit, price_observed, price_min, photo_url, added_by } = body

    if (!source_id || !name || !category || !price_observed) {
      return NextResponse.json({ error: 'source_id, name, category, price_observed requis' }, { status: 400 })
    }

    // Vérifie que la source existe
    const { data: src } = await supabaseAdmin
      .from('price_sources')
      .select('id, name, verified')
      .eq('id', source_id)
      .maybeSingle()

    if (!src) return NextResponse.json({ error: 'Source introuvable' }, { status: 404 })

    // price_market = prix observé en magasin (c'est déjà le prix local)
    // price_min = estimation basse (si non fourni = 80% du prix observé)
    // price_max = prix observé (plafond)
    const priceMin = price_min || Math.round(price_observed * 0.80)

    const payload: Record<string, any> = {
      name,
      category,
      unit: unit || 'unité',
      tier: 'standard',
      price_market:    price_observed,
      price_min:       priceMin,
      price_max:       price_observed,
      source:          src.name,
      source_id,
      added_by:        added_by || null,
      last_scraped_at: new Date().toISOString(),
    }
    if (photo_url) payload.photo_url = photo_url

    // Upsert si un article du même nom existe déjà dans cette source
    const { data: existing } = await supabaseAdmin
      .from('price_materials')
      .select('id')
      .eq('name', name)
      .eq('source_id', source_id)
      .maybeSingle()

    const { data, error } = existing
      ? await supabaseAdmin.from('price_materials').update(payload).eq('id', existing.id).select().single()
      : await supabaseAdmin.from('price_materials').insert(payload).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, material: data })
  }

  // ── Confirmer un article (admin — valide que le prix est juste) ───────────
  if (action === 'confirm_material') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('price_materials')
      .update({ confirmed_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'action inconnue' }, { status: 400 })
}
