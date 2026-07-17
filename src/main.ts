import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { installSafariGestureLock } from './lib/safariGestureLock'
import 'vant/lib/index.css'
import './styles/main.css'

installSafariGestureLock()
createApp(App).use(router).mount('#app')
