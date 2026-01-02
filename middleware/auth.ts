/**
 * Auth middleware - protects routes from unauthenticated access
 * Redirects to /login if user is not authenticated
 */
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useSupabaseUser()

  // If the route requires auth and user is not logged in, redirect to login
  if (!user.value && to.path !== '/login') {
    return navigateTo('/login')
  }

  // If user is logged in and trying to access login page, redirect to home
  if (user.value && to.path === '/login') {
    return navigateTo('/')
  }
})
