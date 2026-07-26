import { i18n, type AppLocale } from '@/i18n'

type ShareMessages = {
  common?: {
    shareTitle?: string
    shareBody?: string
  }
}

/** Clipboard / share-sheet style trip invite (title + blurb + URL). */
export function buildTripShareMessage(title: string, text: string, url: string): string {
  return `${title}\n${text}\n\n${url}`
}

function shareStrings(shareLocale: AppLocale): { title: string; text: string } {
  const locale = shareLocale === 'en' ? 'en' : 'ja'
  // Read messages directly — avoids vue-i18n `t(..., { locale })` overload pitfalls.
  const msgs = i18n.global.getLocaleMessage(locale) as ShareMessages
  return {
    title: msgs.common?.shareTitle ?? '',
    text: msgs.common?.shareBody ?? '',
  }
}

/** Build invite copy in the trip's share_locale (not the UI locale). */
export function buildTripShareMessageForLocale(shareLocale: AppLocale, url: string): string {
  const { title, text } = shareStrings(shareLocale)
  return buildTripShareMessage(title, text, url)
}

export function shareCopyParts(shareLocale: AppLocale): { title: string; text: string } {
  return shareStrings(shareLocale)
}
