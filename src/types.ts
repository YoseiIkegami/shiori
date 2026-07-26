export type DateFormat = 'YY.M.D' | 'YYYY.M.D' | 'YY.M.D HH:mm' | 'none'

export type PaymentStatus = 'pending' | 'paid'

export type Trip = {
  id: string
  slug: string
  name: string
  /** Unguessable public URL key (`/t/{share_token}`). */
  share_token?: string
  reveal_at: string | null
  is_revealed: boolean | null
  photos_count: number
  max_photos: number
  plan_id?: 'free' | 'standard' | 'plus'
  show_nicknames?: boolean
  comment_required?: boolean
  date_format?: DateFormat
  expires_at?: string | null
  payment_status?: PaymentStatus
  organizer_email?: string | null
  /** Last confirmation email send (ISO). Used for resend cooldown. */
  organizer_email_sent_at?: string | null
  /** Language for share invite copy (independent of UI). */
  share_locale?: 'ja' | 'en' | null
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
  /** Filter-only 3:4 JPEG (no frame / comment / date). Missing on legacy photos. */
  raw_url?: string | null
  nickname?: string | null
  member_id?: string | null
}

export type ShootState =
  | 'idle'
  | 'shutter'
  | 'preview'
  | 'confirm'
  | 'sending'
  | 'sent'

export type AppMode = 'shoot' | 'gallery'
