const { createHandler, HttpError } = require('./utils/handler.js')
const QuickBooksService = require('./services/quickbooks.js')
const { QB_PAYMENT_METHODS, validatePayment } = require('./services/payment-validation.js')

const UNDEPOSITED_FUNDS_QUERY =
  "SELECT * FROM Account WHERE AccountType = 'Other Current Asset' AND AccountSubType = 'UndepositedFunds' MAXRESULTS 1"

exports.handler = createHandler(
  { methods: 'POST', errorMessage: 'Failed to record payment' },
  async ({ user, company, body }) => {
    const problem = validatePayment(body)
    if (problem) throw new HttpError(problem, 400)

    const { customerId, amount, paymentMethod, paymentDate, lines } = body

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
      PaymentMethodRef: { name: QB_PAYMENT_METHODS[paymentMethod] },
      DepositToAccountRef: { value: depositAccount.Id, name: depositAccount.Name },
      Line: lines.map((line) => ({
        Amount: line.amount,
        LinkedTxn: [{ TxnId: line.invoiceId, TxnType: 'Invoice' }],
      })),
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
