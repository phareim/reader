import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') || '')
  const body = await readBody(event)
  const { isRead } = body

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  if (typeof isRead !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: 'isRead must be a boolean'
    })
  }

  try {
    await prisma.article.update({
      where: { id },
      data: {
        isRead,
        readAt: isRead ? new Date() : null
      }
    })

    return { success: true }
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Article not found'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update article',
      message: error.message
    })
  }
})
