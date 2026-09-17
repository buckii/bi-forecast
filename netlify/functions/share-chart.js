// Shares the forecast chart to Slack as a PNG. Tabular data goes as text, not as a picture.

const { createHandler, HttpError } = require('./utils/handler.js')
const SlackService = require('./services/slack.js')
const { format } = require('date-fns')

exports.handler = createHandler(
  { methods: 'POST', errorMessage: 'Failed to share chart to Slack' },
  async ({ company, body }) => {
    const { imageData, chartTitle } = body
    if (!imageData) throw new HttpError('Image data is required', 400)

    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    const now = new Date()
    const filename = `revenue-forecast-${format(now, 'yyyy-MM-dd-HHmm')}.png`
    const title = chartTitle || 'Monthly Revenue Forecast'
    const comment = `:chart_with_upwards_trend: *${title}* from ${company.name}

Generated on ${format(now, "MMMM d, yyyy 'at' h:mm a")}`

    const result = await new SlackService().uploadFile(imageBuffer, filename, title, comment)

    return {
      message: 'Chart shared to Slack successfully',
      slackFile: {
        id: result.file?.id,
        url: result.file?.permalink,
        timestamp: result.file?.timestamp
      }
    }
  }
)
