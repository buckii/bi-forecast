const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const SlackService = require('./services/slack.js')
const { format, parse } = require('date-fns')

// Slack caps a section block's text at 3000 characters. Chunk well under that so a
// long client list spills into extra blocks instead of being rejected.
const SECTION_CHAR_LIMIT = 2800

// Slack also rejects a message over 50 blocks. Cap how many clients are listed
// individually so an unusually long month degrades into an overflow line instead
// of a failed post.
const MAX_LISTED_CLIENTS = 100

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0)
}

function formatPercent(value, total) {
  if (!total) return '0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

function monthLabel(month) {
  try {
    return format(parse(month, 'yyyy-MM-dd', new Date()), 'MMMM yyyy')
  } catch (err) {
    return month
  }
}

/**
 * Build the Block Kit payload for a client revenue breakdown.
 *
 * Named clients are listed individually; everything below the threshold is rolled
 * up into a single line so the totals still reconcile without listing every client.
 */
function buildBlocks({ clients, month, asOf, includeWeightedSales, threshold, pricePerPoint, companyName, appUrl }) {
  const sorted = [...clients].sort((a, b) => (b.total || 0) - (a.total || 0))
  const total = sorted.reduce((sum, c) => sum + (c.total || 0), 0)

  const aboveThreshold = sorted.filter(c => (c.total || 0) >= threshold)
  const named = aboveThreshold.slice(0, MAX_LISTED_CLIENTS)
  const overflow = aboveThreshold.slice(MAX_LISTED_CLIENTS)
  const overflowTotal = overflow.reduce((sum, c) => sum + (c.total || 0), 0)

  const rest = sorted.filter(c => (c.total || 0) < threshold)
  const restTotal = rest.reduce((sum, c) => sum + (c.total || 0), 0)

  const points = value => (value / pricePerPoint).toFixed(1)
  const label = monthLabel(month)

  const contextParts = [
    asOf ? `As of ${format(parse(asOf, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')}` : 'As of today',
    includeWeightedSales ? 'includes weighted sales' : 'excludes weighted sales'
  ]

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Client Revenue — ${label}`, emoji: true }
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${companyName} · ${contextParts.join(' · ')}` }]
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Total*  ${formatCurrency(total)}  ·  ${points(total)} pts  ·  ${sorted.length} clients`
      }
    },
    { type: 'divider' }
  ]

  // Client lines, chunked across as many section blocks as needed
  const lines = named.map(client =>
    `*${client.client}*\n${formatCurrency(client.total)} · ${points(client.total)} pts · ${formatPercent(client.total, total)}`
  )

  if (lines.length === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `_No clients at or above ${formatCurrency(threshold)} this month._` }
    })
  } else {
    let chunk = []
    let chunkLength = 0

    for (const line of lines) {
      if (chunkLength + line.length + 2 > SECTION_CHAR_LIMIT && chunk.length > 0) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: chunk.join('\n\n') } })
        chunk = []
        chunkLength = 0
      }
      chunk.push(line)
      chunkLength += line.length + 2
    }

    if (chunk.length > 0) {
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: chunk.join('\n\n') } })
    }
  }

  // Clients above the threshold that did not fit the block budget
  if (overflow.length > 0) {
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `＋ ${overflow.length} more at or above ${formatCurrency(threshold)} — ${formatCurrency(overflowTotal)} · ${points(overflowTotal)} pts · ${formatPercent(overflowTotal, total)}`
      }]
    })
  }

  // Roll up everything under the threshold so the total still reconciles
  if (rest.length > 0) {
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `＋ ${rest.length} ${rest.length === 1 ? 'client' : 'clients'} under ${formatCurrency(threshold)} — ${formatCurrency(restTotal)} · ${points(restTotal)} pts · ${formatPercent(restTotal, total)}`
      }]
    })
  }

  if (appUrl) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `<${appUrl}|Open the full breakdown in BI Forecast>` }]
    })
  }

  // Fallback text for notifications and clients that cannot render blocks
  const fallback = `Client Revenue — ${label}: ${formatCurrency(total)} across ${sorted.length} clients`

  return { blocks, fallback, total, namedCount: named.length, rolledUpCount: rest.length }
}

exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'POST') {
    return error('Method not allowed', 405)
  }

  try {
    const { company } = await getCurrentUser(event)

    const body = JSON.parse(event.body || '{}')
    const {
      clients,
      month,
      asOf = null,
      includeWeightedSales = true,
      threshold = 3000,
      appUrl = null,
      imageData = null
    } = body

    if (!Array.isArray(clients) || clients.length === 0) {
      return error('Client data is required', 400)
    }

    if (!month || !/^\d{4}-\d{2}-\d{2}$/.test(month)) {
      return error('Invalid month format. Use YYYY-MM-DD', 400)
    }

    const pricePerPoint = company.settings?.pricePerPoint || 550

    const { blocks, fallback, total, namedCount, rolledUpCount } = buildBlocks({
      clients,
      month,
      asOf,
      includeWeightedSales,
      threshold,
      pricePerPoint,
      companyName: company.name,
      appUrl
    })

    const slack = new SlackService()
    const message = await slack.postBlocks(blocks, fallback)

    if (!message) {
      return error('Slack is not configured (SLACK_BOT_TOKEN / SLACK_CHANNEL_ID)', 503)
    }

    // Attach the pie chart as a thread reply so the numbers stay the readable part
    // of the post. A failed image upload must not fail the share - the message,
    // which carries the actual data, is already posted.
    let chartShared = false
    if (imageData) {
      try {
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '')
        const imageBuffer = Buffer.from(base64Data, 'base64')
        const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm')
        const filename = `client-revenue-${timestamp}.png`

        await slack.uploadFile(
          imageBuffer,
          filename,
          `Client Revenue — ${monthLabel(month)}`,
          null,
          message.ts
        )
        chartShared = true
      } catch (uploadError) {
        console.error('Client revenue chart upload failed (message was posted):', uploadError)
      }
    }

    return success({
      message: 'Client revenue shared to Slack successfully',
      total,
      namedCount,
      rolledUpCount,
      chartShared,
      slackMessage: {
        ts: message.ts,
        channel: message.channel
      }
    })

  } catch (err) {
    console.error('Share client revenue error:', err)
    return error(err.message || 'Failed to share client revenue to Slack', 500, {
      errorDetails: err.stack,
      slackConfigured: {
        hasBotToken: !!process.env.SLACK_BOT_TOKEN,
        hasChannelId: !!process.env.SLACK_CHANNEL_ID
      }
    })
  }
}

// Exported for tests
exports.buildBlocks = buildBlocks
