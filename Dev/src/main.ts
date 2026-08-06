import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// 全局样式（沿用现有样式表，类名零改动）
import '../style/main.css'
import '../style/fonts.css'

createApp(App).use(createPinia()).mount('#app')
