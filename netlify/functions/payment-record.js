const { success, error } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const QuickBooksService = require('./services/quickbooks')

const PAYMENT_METHOD_MAP = {
  'check': 'Check',
  'ach': 'Electronic Payment',
  'credit_card': 'Credit Card',
  'cash': 'Cash',
  'other': 'Other'
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return error('Method not allowed', 405)
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch (err) {
    return error('Invalid request body', 400)
  }

  const { invoiceId, customerId, amount, paymentMethod, paymentDate } = body

  if (!invoiceId || !customerId || !amount || !paymentMethod || !paymentDate) {
    return error('Missing required fields', 400)
  }

  try {
    const { user, company } = await getCurrentUser(event)
    const qbService = new QuickBooksService(company._id)
    const { accessToken, realmId } = await qbService.getAccessToken()
    
    // First get the deposit account (usually Undeposited Funds)
    const accountsQuery = "SELECT * FROM Account WHERE AccountType = 'Other Current Asset' AND AccountSubType = 'UndepositedFunds' MAXRESULTS 1"
    const accountsData = await qbService.makeRequest(`query?query=${encodeURIComponent(accountsQuery)}`, realmId, accessToken)
    
    const depositAccount = accountsData?.QueryResponse?.Account?.[0]
    if (!depositAccount) {
      throw new Error('Could not find Undeposited Funds account')
    }

    // Create the payment object
    const payment = {
      CustomerRef: {
        value: customerId
      },
      TotalAmt: amount,
      TxnDate: paymentDate,
      PrivateNote: `Payment recorded via BI Forecast by ${user.email}`,
      PaymentMethodRef: {
        name: PAYMENT_METHOD_MAP[paymentMethod] || 'Other'
      },
      DepositToAccountRef: {
        value: depositAccount.Id,
        name: depositAccount.Name
      },
      Line: [{
        Amount: amount,
        LinkedTxn: [{
          TxnId: invoiceId,
          TxnType: 'Invoice'
        }]
      }]
    }

    // Create the payment in QuickBooks
    const paymentResponse = await fetch(`${qbService.baseUrl}/v3/company/${realmId}/payment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payment)
    })

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text()
      throw new Error(`Failed to create payment: ${errorText}`)
    }

    const paymentData = await paymentResponse.json()

    return success({
      success: true,
      paymentId: paymentData.Payment?.Id,
      paymentNumber: paymentData.Payment?.DocNumber,
      amount: paymentData.Payment?.TotalAmt || amount,
      message: 'Payment recorded successfully',
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('Error recording payment:', err)
    return error('Failed to record payment: ' + err.message, 500)
  }
}