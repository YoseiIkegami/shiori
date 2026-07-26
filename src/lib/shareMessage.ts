import { i18n, type AppLocale } from '@/i18n'

/** Clipboard / share-sheet style trip invite (title + blurb + URL). */
export function buildTripShareMessage(title: string, text: string, url: string): string {
  return `${title}\n${text}\n\n${url}`
}

/** Build invite copy in the trip's share_locale (not the UI locale). */
export function buildTripShareMessageForLocale(shareLocale: AppLocale, url: string): string {
  const locale = shareLocale === 'en' ? 'en' : 'ja'
  const title = String(i18n.global.t('common.shareTitle', {}, { locale }))
  const text = String(i18n.global.t('common.shareBody', {}, { locale }))
  return buildTripShareMessage(title, text, url)
}

export function shareCopyParts(shareLocale: AppLocale): { title: string; text: string } {
  const locale = shareLocale === 'en' ? 'en' : 'ja'
  return {
    title: String(i18n.global.t('common.shareTitle', {}, { locale })),
    text: String(i18n.global.t('common.shareBody', {}, { locale })),
  }
}
