import { db } from '../../lib/db'

async function checkFailedUrlsAndUsers() {
  try {
    const failedUrls = await db.watchedUrl.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    console.log(`=== Failed WatchedUrl Records (${failedUrls.length}) ===`)
    failedUrls.forEach((u, i) => {
      console.log(`\n[${i + 1}] URL: ${u.url}`)
      console.log(`    Status: ${u.status}`)
      console.log(`    Title: ${u.title}`)
      console.log(`    Justification: ${u.justification}`)
    })

    const users = await db.user.findMany()
    console.log(`\n=== User Configurations (${users.length}) ===`)
    users.forEach((u, i) => {
      console.log(`\n[${i + 1}] User: ${u.username} (Email: ${u.email})`)
      console.log(`    Provider: ${u.provider}`)
      console.log(`    BaseURL: ${u.baseUrl}`)
      console.log(`    Model: ${u.model}`)
      console.log(`    ConfirmModel: ${u.confirmModel}`)
      console.log(`    LlmConfigs: ${u.llmConfigs}`)
    })
  } catch (error: any) {
    console.error('Error checking database:', error.message)
  }
}

checkFailedUrlsAndUsers()

