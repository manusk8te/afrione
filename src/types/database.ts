// ============================================
// AFRIONE — Types TypeScript
// Correspond aux 15 tables PostgreSQL
// ============================================

export type UserRole = 'client' | 'artisan' | 'admin'
export type KycStatus = 'pending' | 'approved' | 'rejected'
export type MissionStatus = 'diagnostic' | 'matching' | 'negotiation' | 'payment' | 'en_route' | 'en_cours' | 'completed' | 'disputed' | 'cancelled'
export type TransactionStatus = 'escrow' | 'released' | 'refunded' | 'pending'
export type QuotationStatus = 'proposed' | 'accepted' | 'rejected' | 'renegotiation'

// ---- PROFILING ----

export interface User {
  id: string
  phone: string
  name: string
  email?: string
  role: UserRole
  avatar_url?: string
  created_at: string
  updated_at: string
  is_active: boolean
  quartier?: string
}

export interface ArtisanPro {
  id: string
  user_id: string
  bio?: string
  specialties: string[]
  metier: string
  zone_gps?: { lat: number; lng: number }
  quartiers: string[]
  rating_avg: number
  rating_count: number
  mission_count: number
  years_experience: number
  certifications: string[]
  kyc_status: KycStatus
  tarif_min: number
  rayon_km: number
  is_available: boolean
  response_time_min: number
  success_rate: number
  created_at: string
  // Relations
  user?: User
  kyc?: KycSecurity
  portfolio?: string[]
}

export interface KycSecurity {
  id: string
  artisan_id: string
  cni_front_url?: string
  cni_back_url?: string
  diploma_urls: string[]
  status: KycStatus
  rejection_reason?: string
  reviewed_at?: string
  reviewed_by?: string
  created_at: string
}

// ---- MARKET INTEL ----

export interface PriceMaterial {
  id: string
  name: string
  category: string
  unit: string
  price_market: number
  price_min: number
  price_max: number
  source: string // ex: 'Adjamé' | 'Treichville'
  updated_at: string
}

export interface LaborRate {
  id: string
  metier: string
  tarif_horaire: number
  majoration_urgence: number // % ex: 50 = +50%
  majoration_nuit: number
  majoration_weekend: number
  zone: string
  updated_at: string
}

export interface ServiceFee {
  id: string
  category: string
  commission_pct: number
  frais_fixe: number
  assurance_sav_pct: number
  artisan_share_pct: number
  updated_at: string
}

// ---- MISSION FLOW ----

export interface Mission {
  id: string
  client_id: string
  artisan_id?: string
  status: MissionStatus
  category: string
  quartier: string
  address?: string
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
  // Relations
  client?: User
  artisan?: ArtisanPro
  diagnostic?: Diagnostic
  quotation?: Quotation
  proof?: ProofOfWork
}

export interface Diagnostic {
  id: string
  mission_id: string
  raw_text: string
  ai_summary: string
  category_detected: string
  estimated_price_min: number
  estimated_price_max: number
  items_needed: string[]
  urgency_level: 'low' | 'medium' | 'high' | 'emergency'
  embedding?: number[]
  created_at: string
}

export interface Quotation {
  id: string
  mission_id: string
  materials: QuotationItem[]
  labor_cost: number
  platform_fee: number
  assurance_fee: number
  total_price: number
  artisan_receives: number
  status: QuotationStatus
  notes?: string
  created_at: string
  updated_at: string
}

export interface QuotationItem {
  name: string
  quantity: number
  unit: string
  unit_price: number
  total: number
}

export interface ProofOfWork {
  id: string
  mission_id: string
  photo_before_urls: string[]
  photo_after_urls: string[]
  client_signature?: string
  artisan_notes?: string
  validated_at?: string
  created_at: string
}

// ---- COMM & GPS ----

export interface ChatMessage {
  id: string
  mission_id: string
  sender_id: string
  sender_role: UserRole
  text?: string
  media_urls: string[]
  type: 'text' | 'image' | 'video' | 'system' | 'quotation'
  read_at?: string
  created_at: string
}

export interface GpsTracking {
  id: string
  mission_id: string
  artisan_id: string
  lat: number
  lng: number
  eta_minutes?: number
  speed_kmh?: number
  is_active: boolean
  created_at: string
}

// ---- FINANCE ----

export interface Transaction {
  id: string
  mission_id: string
  wave_transaction_id?: string
  amount: number
  platform_fee: number
  artisan_amount: number
  status: TransactionStatus
  payment_method: 'wave' | 'orange_money' | 'mtn' | 'cash'
  created_at: string
  released_at?: string
}

export interface Wallet {
  id: string
  artisan_id: string
  balance_available: number
  balance_escrow: number
  total_earned: number
  total_withdrawn: number
  updated_at: string
}

// ---- IA ----

export interface ProblemEmbedding {
  id: string
  diagnostic_id: string
  category: string
  embedding: number[]
  resolution: string
  avg_price: number
  avg_duration_min: number
  created_at: string
}

export interface SentimentLog {
  id: string
  mission_id?: string
  artisan_id?: string
  source: 'review' | 'chat' | 'dispute'
  sentiment_score: number // -1 à 1
  flags: string[]
  raw_text: string
  created_at: string
}

// ---- DATABASE TYPE (pour Supabase) ----

export interface Database {
  public: {
    Tables: {
      users: { Row: User; Insert: Partial<User>; Update: Partial<User> }
      artisan_pros: { Row: ArtisanPro; Insert: Partial<ArtisanPro>; Update: Partial<ArtisanPro> }
      kyc_security: { Row: KycSecurity; Insert: Partial<KycSecurity>; Update: Partial<KycSecurity> }
      price_materials: { Row: PriceMaterial; Insert: Partial<PriceMaterial>; Update: Partial<PriceMaterial> }
      labor_rates: { Row: LaborRate; Insert: Partial<LaborRate>; Update: Partial<LaborRate> }
      service_fees: { Row: ServiceFee; Insert: Partial<ServiceFee>; Update: Partial<ServiceFee> }
      missions: { Row: Mission; Insert: Partial<Mission>; Update: Partial<Mission> }
      diagnostics: { Row: Diagnostic; Insert: Partial<Diagnostic>; Update: Partial<Diagnostic> }
      quotations: { Row: Quotation; Insert: Partial<Quotation>; Update: Partial<Quotation> }
      proof_of_work: { Row: ProofOfWork; Insert: Partial<ProofOfWork>; Update: Partial<ProofOfWork> }
      chat_history: { Row: ChatMessage; Insert: Partial<ChatMessage>; Update: Partial<ChatMessage> }
      gps_tracking: { Row: GpsTracking; Insert: Partial<GpsTracking>; Update: Partial<GpsTracking> }
      transactions: { Row: Transaction; Insert: Partial<Transaction>; Update: Partial<Transaction> }
      wallets: { Row: Wallet; Insert: Partial<Wallet>; Update: Partial<Wallet> }
      problem_embeddings: { Row: ProblemEmbedding; Insert: Partial<ProblemEmbedding>; Update: Partial<ProblemEmbedding> }
      sentiment_logs: { Row: SentimentLog; Insert: Partial<SentimentLog>; Update: Partial<SentimentLog> }
    }
  }
}
