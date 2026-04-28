export type Database = {
  public: {
    Tables: {
      users: { Row: any; Insert: any; Update: any }
      artisan_pros: { Row: any; Insert: any; Update: any }
      kyc_security: { Row: any; Insert: any; Update: any }
      missions: { Row: any; Insert: any; Update: any }
      diagnostics: { Row: any; Insert: any; Update: any }
      quotations: { Row: any; Insert: any; Update: any }
      proof_of_work: { Row: any; Insert: any; Update: any }
      chat_history: { Row: any; Insert: any; Update: any }
      gps_tracking: { Row: any; Insert: any; Update: any }
      transactions: { Row: any; Insert: any; Update: any }
      wallets: { Row: any; Insert: any; Update: any }
      price_materials: { Row: any; Insert: any; Update: any }
      labor_rates: { Row: any; Insert: any; Update: any }
      service_fees: { Row: any; Insert: any; Update: any }
      problem_embeddings: { Row: any; Insert: any; Update: any }
      sentiment_logs: { Row: any; Insert: any; Update: any }
    }
    Views: {}
    Functions: {}
  }
}
