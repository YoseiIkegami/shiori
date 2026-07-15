export type Trip = {
  id: string
  name: string
  reveal_at: string
  is_revealed: boolean | null
  created_at?: string
}

export type PhotoRow = {
  id: string
  trip_id: string
  storage_path: string
  comment: string
  rotation: number | null
  created_at: string
}

export type RevealedPhoto = {
  id: string
  trip_id: string
  comment: string
  rotation: number | null
  created_at: string
  url: string
}

export type ShootState = 'idle' | 'shutter' | 'preview' | 'confirm' | 'sending' | 'sent'

export type AppMode = 'shoot' | 'gallery'
