import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isValidToken } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { transactionIds, paymentMethod } = body

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: 'Transaction IDs are required' },
        { status: 400 }
      )
    }

    console.log("transactionIds.length", transactionIds.length)

    if (!paymentMethod) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      )
    }

    // Query ALL payments with the provided transaction IDs (both successful and unsuccessful)
    const payments = await prisma.tbl_mobile_payments.findMany({
      where: {
        AND: [
          {
            transaction_id: {
              in: transactionIds
            }
          },
          {
            transaction_id: {
              not: ''
            }
          },
          {
            payment_method: paymentMethod
          }
        ]
      },
      select: {
        transaction_id: true,
        msisdn: true,
        payment_status: true,
        amount: true
      }
    })

    console.log("payments.length", payments.length)

    // Get payment IDs to check against token history
    const paymentIds = payments
        .map(p => p.transaction_id)
        .filter((transaction_id): transaction_id is string => transaction_id !== null && transaction_id !== "");
    console.log("paymentId.length", paymentIds.length)

    // Fetch token history for these payments
    const tokenHistory = await prisma.token_history_data.findMany({
      where: {
        txn_id: {
          in: paymentIds
        }
      },
      select: {
        txn_id: true,
        luku: true,
        passcode: true,
      }
    })
    console.log("tokenHistory.length", tokenHistory.length)

    // Create a Set of payment IDs that have valid tokens
    const paymentsWithValidTokens = new Set<string>()
    tokenHistory.forEach(token => {
      if (token.luku && isValidToken(token.luku)) {
        paymentsWithValidTokens.add(token.txn_id)
      }
      else if (token.passcode && isValidToken(token.passcode)) {
        paymentsWithValidTokens.add(token.txn_id)
      }
    })

    // Categorize payments into successful and unsuccessful
    const unsuccessfulPayments = payments
      .filter(payment =>
        payment.payment_status === 'NOT SUCCESFUL' &&
        !paymentsWithValidTokens.has(payment.transaction_id || '')
      )
      .map(payment => ({
        TRANSACTION_ID: payment.transaction_id,
        MSISDN: payment.msisdn,
        STATUS: 'NOT SUCCESSFUL',
        AMOUNT: payment.amount
      }))
    console.log("unsuccessfulPayments.length", unsuccessfulPayments.length)

    // Find not found payments (those not in database at all)
    const foundTransactionIds = new Set(payments.map(p => p.transaction_id))
    console.log("foundTransactionIds.size", foundTransactionIds.size)
    const notFoundPayments = transactionIds
      .filter(txnId => !foundTransactionIds.has(txnId))
      .map(txnId => ({
        TRANSACTION_ID: txnId,
        MSISDN: "",
        STATUS: 'NOT FOUND',
        AMOUNT: ""
      }))
    console.log("notFoundPayments.length", notFoundPayments.length)

    // Find successful payments (those with valid tokens OR success status)
    const successfulPayments = payments
      .filter(payment =>
        paymentsWithValidTokens.has(payment.transaction_id || '') ||
        payment.payment_status !== 'NOT SUCCESFUL'
      )
      .map(payment => ({
        TRANSACTION_ID: payment.transaction_id,
        MSISDN: payment.msisdn,
        STATUS: 'SUCCESSFUL',
        AMOUNT: payment.amount
      }))
    console.log("successfulPayments.length", successfulPayments.length)

    return NextResponse.json({
      unsuccessful: unsuccessfulPayments,
      successful: successfulPayments,
      notFound: notFoundPayments,
      total: unsuccessfulPayments.length + successfulPayments.length + notFoundPayments.length
    })
  } catch (error) {
    console.error('Refund upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process uploaded data' },
      { status: 500 }
    )
  }
}
