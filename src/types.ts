export type DateFormat = 'YY.M.D' | 'YYYY.M.D' | 'YY.M.D HH:mm' | 'none'

export type PaymentStatus = 'pending' | 'paid'

export type Trip = {
  id: string
  slug: string
  name: string
  reveal_at: string | null
  is_revealed: boolean | null
  photos_count: number
  max_photos: number
  show_nicknames?: boolean
  comment_required?: boolean
  date_format?: DateFormat
  expires_at?: string | null
  payment_status?: PaymentStatus
  theme_id?: string
  created_at?: string
}

export type PhotoRow = {
  id: string
  trip_id: string
  storage_path: string
  comment: string
  rotation: number | null
  created_at: string
  member_id?: string | null
}

export type RevealedPhoto = {
  id: string
  trip_id: string
  comment: string
  rotation: number | null
  created_at: string
  url: string
}

export type ShootState =
  | 'idle'
  | 'shutter'
  | 'preview'
  | 'confirm'
  | 'sending'
  | 'sent'

export type AppMode = 'shoot' | 'gallery'
