import { createI18n } from 'vue-i18n'
import { Locale as VantLocale } from 'vant'
import enUS from 'vant/es/locale/lang/en-US'
import jaJP from 'vant/es/locale/lang/ja-JP'
import en from '@/locales/en.json'
import ja from '@/locales/ja.json'

export const SUPPORTED_LOCALES = ['ja', 'en'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]
export type CheckoutCurrency = 'jpy' | 'usd'

/** Native-language labels for the locale switcher. Add a row per new locale. */
export const LOCALE_LABELS: Record<AppLocale, string> = {
  ja: '日本語',
  en: 'English',
}

function isAppLocale(v: unknown): v is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(v as string)
}

const STORAGE_KEY = 'shiori.locale.v2'
const LEGACY_STORAGE_KEY = 'shiori.locale'

export const i18n = createI18n({
  legacy: false,
  locale: 'ja',
  fallbackLocale: 'ja',
  messages: { ja, en },
  numberFormats: {
    ja: {
      currency: {
        style: 'currency',
        currency: 'JPY',
        currencyDisplay: 'narrowSymbol',
        maximumFractionDigits: 0,
      },
    },
    en: {
      currency: {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    },
  },
})

export function detectLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isAppLocale(stored)) return stored
    // Drop legacy auto-detected en from browser language; product default is ja.
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  return 'ja'
}

export function currencyForLocale(locale: AppLocale = getLocale()): CheckoutCurrency {
  return locale === 'ja' ? 'jpy' : 'usd'
}

export function getLocale(): AppLocale {
  const loc = i18n.global.locale.value
  return isAppLocale(loc) ? loc : 'ja'
}

function syncDocumentLang(locale: AppLocale) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
  }
}

function syncVantLocale(locale: AppLocale) {
  VantLocale.use(locale === 'ja' ? 'ja-JP' : 'en-US', locale === 'ja' ? jaJP : enUS)
}

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
  syncDocumentLang(locale)
  syncVantLocale(locale)
}

export function initI18n() {
  setLocale(detectLocale())
}
