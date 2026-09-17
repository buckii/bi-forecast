const { createHandler, HttpError } = require('./utils/handler.js')
const QuickBooksService = require('./services/quickbooks.js')

const PAYMENT_METHOD_MAP = {
  check: 'Check',
  ach: 'Electronic Payment',
  credit_card: 'Credit Card',
  cash: 'Cash',
  other: 'Other',
}

const REQUIRED_FIELDS = ['invoiceId', 'customerId', 'amount', 'paymentMethod', 'paymentDate']

const UNDEPOSITED_FUNDS_QUERY =
  "SELECT * FROM Account WHERE AccountType = 'Other Current Asset' AND AccountSubType = 'UndepositedFunds' MAXRESULTS 1"

exports.handler = createHandler(
  { methods: 'POST', errorMessage: 'Failed to record payment' },
  async ({ user, company, body }) => {
    const missing = REQUIRED_FIELDS.filter((field) => !body[field])
    if (missing.length > 0) {
      throw new HttpError(`Missing required fields: ${missing.join(', ')}`, 400)
    }

    const { invoiceId, customerId, amount, paymentMethod, paymentDate } = body

    const qbo = new QuickBooksService(company._id)
    const { accessToken, realmId } = await qbo.getAccessToken()

    const accountsData = await qbo.makeRequest(
      `query?query=${encodeURIComponent(UNDEPOSITED_FUNDS_QUERY)}`,
      realmId,
      accessToken,
    )

    const depositAccount = accountsData?.QueryResponse?.Account?.[0]
    if (!depositAccount) {
      throw new HttpError('Could not find Undeposited Funds account', 422)
    }

    const payment = {
      CustomerRef: { value: customerId },
      TotalAmt: amount,
      TxnDate: paymentDate,
      PrivateNote: `Payment recorded via BI Forecast by ${user.email}`,
      PaymentMethodRef: { name: PAYMENT_METHOD_MAP[paymentMethod] || 'Other' },
      DepositToAccountRef: { value: depositAccount.Id, name: depositAccount.Name },
      Line: [{ Amount: amount, LinkedTxn: [{ TxnId: invoiceId, TxnType: 'Invoice' }] }],
    }

    // Routed through makeRequest so it gets the shared token refresh and retry.
    const paymentData = await qbo.makeRequest('payment', realmId, accessToken, 0, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment),
    })

    return {
      paymentId: paymentData.Payment?.Id,
      paymentNumber: paymentData.Payment?.DocNumber,
      amount: paymentData.Payment?.TotalAmt || amount,
      message: 'Payment recorded successfully',
      timestamp: new Date().toISOString(),
    }
  },
)
