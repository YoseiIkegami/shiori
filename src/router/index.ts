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
      path: '/create',
      name: 'create',
      component: () => import('@/pages/CreateTripPage.vue'),
    },
    {
      path: '/create/success',
      name: 'create-success',
      component: () => import('@/pages/CheckoutSuccessPage.vue'),
    },
    {
      path: '/manage/:slug',
      name: 'manage',
      component: () => import('@/pages/ManageTripPage.vue'),
      props: true,
    },
    {
      path: '/terms',
      name: 'terms',
      component: () => import('@/pages/TermsPage.vue'),
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('@/pages/PrivacyPage.vue'),
    },
    {
      path: '/legal',
      name: 'legal',
      component: () => import('@/pages/LegalPage.vue'),
    },
    {
      path: '/t/:tripId',
      name: 'trip',
      component: TripPage,
      props: true,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
    },
  ],
})

export default router
