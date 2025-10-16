import { NuxtAuthHandler } from '#auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import prisma from '~/server/utils/db'

export default NuxtAuthHandler({
  secret: process.env.AUTH_SECRET,

  adapter: PrismaAdapter(prisma),

  providers: [
    // @ts-expect-error Use .default here for it to work during SSR
    GoogleProvider.default({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
    })
  ],

  callbacks: {
    session: async ({ session, user }) => {
      if (session?.user) {
        session.user.id = user.id
      }
      return session
    }
  },

  pages: {
    signIn: '/login',
    error: '/login'
  }
})
