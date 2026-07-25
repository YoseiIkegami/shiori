import { createI18n } from 'vue-i18n'
import { Locale as VantLocale } from 'vant'
import enUS from 'vant/es/locale/lang/en-US'
import jaJP from 'vant/es/locale/lang/ja-JP'
import en from '@/locales/en.json'
import ja from '@/locales/ja.json'

export const SUPPORTED_LOCALES = ['ja', 'en'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]
export type CheckoutCurrency = 'jpy' | 'usd'

const STORAGE_KEY = 'shiori.locale'

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
        maximumFractionDigits: 0,
      },
    },
  },
})

export function detectLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'ja' || stored === 'en') return stored
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'ja'
  return nav.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

export function currencyForLocale(locale: AppLocale = getLocale()): CheckoutCurrency {
  return locale === 'ja' ? 'jpy' : 'usd'
}

export function getLocale(): AppLocale {
  const loc = i18n.global.locale.value
  return loc === 'en' ? 'en' : 'ja'
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
