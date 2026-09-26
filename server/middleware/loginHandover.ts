import { getRequestURL, getQuery, sendRedirect } from 'h3'
import { authLoginUrl, handsOverLogin } from '~/utils/authLogin'

// A full page load of /login (a sibling app bouncing a signed-out visitor)
// goes straight to auth.phareim.no, before the local form renders.
// In-app navigations to /login are handed over by pages/login.vue.
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  if (url.pathname !== '/login' || !handsOverLogin(url.hostname)) return
  const query = getQuery(event)
  if (query.direct) return
  return sendRedirect(event, authLoginUrl(query.redirect, url.origin), 302)
})
