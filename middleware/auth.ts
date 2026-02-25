/**
 * Auth middleware - protects routes from unauthenticated access
 * Redirects to /login if user is not authenticated
 */
export default defineNuxtRouteMiddleware((to, from) => {
  const { data: session, status } = useAuth()

  // If the route requires auth and user is not logged in, redirect to login
  if (status.value === 'unauthenticated' && to.path !== '/login') {
    return navigateTo('/login')
  }

  // If user is logged in and trying to access login page, redirect to home
  if (session.value?.user && to.path === '/login') {
    return navigateTo('/')
  }
})
