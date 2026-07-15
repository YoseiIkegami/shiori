import { createRouter, createWebHistory } from 'vue-router'
import TripPage from '@/pages/TripPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
    },
    {
      path: '/t/:tripId',
      name: 'trip',
      component: TripPage,
      props: true,
    },
  ],
})

export default router
