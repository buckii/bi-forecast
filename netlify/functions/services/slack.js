class SlackService {
  constructor() {
    this.botToken = process.env.SLACK_BOT_TOKEN
    this.channelId = process.env.SLACK_CHANNEL_ID
    this.baseUrl = 'https://slack.com/api'
  }

  async sendMessage(message, options = {}) {
    if (!this.botToken || !this.channelId) {
      console.warn('Slack notification skipped: SLACK_BOT_TOKEN or SLACK_CHANNEL_ID not configured')
      return null
    }

    try {
      const payload = {
        channel: this.channelId,
        text: message,
        ...options
      }

      console.log('Slack API request:', {
        url: `${this.baseUrl}/chat.postMessage`,
        channel: this.channelId,
        tokenPrefix: this.botToken.substring(0, 10) + '...',
        messageLength: message.length
      })

      const response = await fetch(`${this.baseUrl}/chat.postMessage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      
      console.log('Slack API response:', {
        status: response.status,
        ok: result.ok,
        error: result.error,
        warning: result.warning
      })

      if (!result.ok) {
        console.error('Slack API error details:', result)
        throw new Error(`Slack API error: ${result.error}`)
      }

      return result
    } catch (error) {
      console.error('Failed to send Slack message:', error)
      throw error
    }
  }

  async sendNightlyJobFailure(companyName, failedDataSources, errors) {
    const failedSources = Array.isArray(failedDataSources) ? failedDataSources.join(', ') : failedDataSources
    const errorDetails = errors ? `\nErrors: ${JSON.stringify(errors, null, 2)}` : ''
    
    const message = `:warning: *Nightly Revenue Forecast Job Failed*

:office: **Company:** ${companyName}
:x: **Failed Data Sources:** ${failedSources}
:clock3: **Time:** ${new Date().toISOString()}${errorDetails}

The revenue forecast data may be incomplete. Please check the system logs and data connections.`

    return this.sendMessage(message, {
      username: 'BI Forecast Bot',
      icon_emoji: ':chart_with_downwards_trend:'
    })
  }

  async sendDataSourceError(companyName, dataSource, error) {
    const message = `:exclamation: *Data Source Error - ${dataSource}*

:office: **Company:** ${companyName}
:x: **Error:** ${error.message || error}
:clock3: **Time:** ${new Date().toISOString()}

The ${dataSource} integration is experiencing issues. This may affect revenue forecasting accuracy.`

    return this.sendMessage(message, {
      username: 'BI Forecast Bot',
      icon_emoji: ':warning:'
    })
  }

  async uploadFile(fileBuffer, filename, title, initialComment) {
    if (!this.botToken || !this.channelId) {
      console.warn('Slack file upload skipped: SLACK_BOT_TOKEN or SLACK_CHANNEL_ID not configured')
      return null
    }

    try {
      // Step 1: Get upload URL using the new files.getUploadURLExternal method
      const formParams = new URLSearchParams({
        filename: filename,
        length: fileBuffer.length.toString()
      })
      
      const uploadUrlResponse = await fetch(`${this.baseUrl}/files.getUploadURLExternal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formParams
      })

      const uploadUrlResult = await uploadUrlResponse.json()
      
      if (!uploadUrlResult.ok) {
        console.error('Failed to get Slack upload URL:', uploadUrlResult)
        throw new Error(`Slack upload URL error: ${uploadUrlResult.error}`)
      }

      const { upload_url, file_id } = uploadUrlResult

      // Step 2: Upload the file to the provided URL
      const uploadResponse = await fetch(upload_url, {
        method: 'POST',
        body: fileBuffer,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': fileBuffer.length.toString()
        }
      })

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file to external URL: ${uploadResponse.status} ${uploadResponse.statusText}`)
      }

      // Step 3: Complete the upload and share to channel using files.completeUploadExternal
      const completeResponse = await fetch(`${this.baseUrl}/files.completeUploadExternal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: [
            {
              id: file_id,
              title: title
            }
          ],
          channel_id: this.channelId,
          initial_comment: initialComment || undefined
        })
      })

      const completeResult = await completeResponse.json()

      if (!completeResult.ok) {
        console.error('Slack file complete error details:', completeResult)
        throw new Error(`Slack file complete error: ${completeResult.error}`)
      }

      return completeResult
    } catch (error) {
      console.error('Failed to upload file to Slack:', error)
      throw error
    }
  }
}

module.exports = SlackService