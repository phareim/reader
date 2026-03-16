import { betterAuth } from 'better-auth'
import { H3Event } from 'h3'
import { getD1 } from '~/server/utils/cloudflare'

/**
 * Create a Better Auth instance per-request.
 * Required because Cloudflare D1 binding is only available from the event context.
 */
export function getAuth(event: H3Event) {
  const db = getD1(event)

  return betterAuth({
    database: db,
    baseURL: process.env.BETTER_AUTH_URL || process.env.AUTH_ORIGIN || 'http://localhost:3000',
    secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      }
    },
    user: {
      modelName: 'User',
      fields: {
        emailVerified: 'email_verified',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      additionalFields: {
        mcp_token: {
          type: 'string',
          required: false,
          input: false,
        },
        mcp_token_created_at: {
          type: 'string',
          required: false,
          input: false,
        },
      },
    },
    session: {
      modelName: 'session',
      fields: {
        userId: 'user_id',
        expiresAt: 'expires_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    account: {
      modelName: 'account',
      fields: {
        userId: 'user_id',
        accountId: 'account_id',
        providerId: 'provider_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        idToken: 'id_token',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    verification: {
      modelName: 'verification',
      fields: {
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
  })
}
