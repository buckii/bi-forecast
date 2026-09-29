// Creates a Google Sheet in the signed-in user's Drive. drive.file only reaches files this app
// creates, so the grant cannot read anything else in their Drive.

import { loadGoogleIdentity } from './google-identity.js'

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const TOKEN_EXPIRY_MARGIN_MS = 60 * 1000

// Held for the life of the tab only; the grant is re-requested after a reload.
let cachedToken = null

/** Starts the script download so the click that exports can open Google's popup immediately. */
export function preloadGoogleSheets() {
  loadGoogleIdentity().catch((err) => console.error('Error loading Google Identity Services:', err))
}

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt - TOKEN_EXPIRY_MARGIN_MS > Date.now()) return cachedToken.value

  const google = await loadGoogleIdentity()

  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error))
          return
        }
        cachedToken = { value: response.access_token, expiresAt: Date.now() + Number(response.expires_in) * 1000 }
        resolve(cachedToken.value)
      },
      error_callback: (err) => reject(new Error(err?.message || 'Google access was not granted')),
    })

    client.requestAccessToken()
  })
}

function toCell(value) {
  if (typeof value === 'number') return { userEnteredValue: { numberValue: value } }
  return { userEnteredValue: { stringValue: value ?? '' } }
}

/**
 * @param {string} title the spreadsheet's name in Drive
 * @param {(string|number)[][]} rows header row first; numbers stay numbers so the sheet can sum them
 * @param {(string|null)[]} columnPatterns a Sheets number format per column, e.g. '#,##0.00'; null for text
 * @returns {Promise<string>} the new sheet's URL
 */
export async function createSpreadsheet(title, rows, columnPatterns) {
  const token = await accessToken()

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: { title: 'Report', gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 } },
          data: [{ startRow: 0, startColumn: 0, rowData: rows.map((row) => ({ values: row.map(toCell) })) }],
        },
      ],
    }),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401) cachedToken = null
    throw new Error(payload.error?.message || 'Google Sheets could not create the spreadsheet')
  }

  await formatSheet(token, payload, rows, columnPatterns)
  return payload.spreadsheetUrl
}

/** Best-effort: the data is already in the sheet, so a formatting failure is only logged. */
async function formatSheet(token, spreadsheet, rows, columnPatterns) {
  const sheetId = spreadsheet.sheets[0].properties.sheetId
  const bold = (range) => ({
    repeatCell: {
      range: { sheetId, ...range },
      cell: { userEnteredFormat: { textFormat: { bold: true } } },
      fields: 'userEnteredFormat.textFormat.bold',
    },
  })

  const numberFormats = columnPatterns
    .map((pattern, column) => ({ pattern, column }))
    .filter(({ pattern }) => pattern)
    .map(({ pattern, column }) => ({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: column, endColumnIndex: column + 1 },
        cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    }))

  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          ...numberFormats,
          bold({ endRowIndex: 1 }),
          bold({ startRowIndex: rows.length - 1 }),
          { autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0 } } },
        ],
      }),
    })
  } catch (err) {
    console.error('Error formatting the new spreadsheet:', err)
  }
}
