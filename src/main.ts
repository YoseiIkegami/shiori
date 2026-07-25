import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { i18n, initI18n } from './i18n'
import { installSafariGestureLock } from './lib/safariGestureLock'
import 'vant/lib/index.css'
import './styles/main.css'

installSafariGestureLock()
initI18n()
createApp(App).use(router).use(i18n).mount('#app')
