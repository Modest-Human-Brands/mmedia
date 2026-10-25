export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      await fetch('https://example.com/webhook/media/uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.API_KEY },
        body: JSON.stringify(message.body),
      })

      message.ack()
    }
  },
}
