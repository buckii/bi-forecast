const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const SlackService = require('./services/slack.js')
const { format } = require('date-fns')

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'POST') {
    return error('Method not allowed', 405)
  }

  try {
    const { company } = await getCurrentUser(event)
    
    const body = JSON.parse(event.body)
    const { imageData, chartTitle } = body
    
    if (!imageData) {
      return error('Image data is required', 400)
    }

    // Convert base64 image data to buffer
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')
    
    // Generate filename with timestamp
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm')
    const filename = `revenue-forecast-${timestamp}.png`
    
    // Prepare Slack upload
    const slack = new SlackService()
    const title = chartTitle || 'Monthly Revenue Forecast'
    const comment = `:chart_with_upwards_trend: **${title}** from ${company.name}

Generated on ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}`

    // Upload to Slack
    const result = await slack.uploadFile(imageBuffer, filename, title, comment)
    
    return success({
      message: 'Chart shared to Slack successfully',
      slackFile: {
        id: result.file?.id,
        url: result.file?.permalink,
        timestamp: result.file?.timestamp
      }
    })
    
  } catch (err) {
    console.error('Share chart error:', err)
    return error(err.message || 'Failed to share chart to Slack', 500, {
      errorDetails: err.stack,
      slackConfigured: {
        hasBotToken: !!process.env.SLACK_BOT_TOKEN,
        hasChannelId: !!process.env.SLACK_CHANNEL_ID
      }
    })
  }
}