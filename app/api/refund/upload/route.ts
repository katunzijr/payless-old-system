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

    if (!paymentMethod) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      )
    }

    // Query payments with the provided transaction IDs
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
          },
          {
            payment_status: 'NOT SUCCESFUL'
          }
        ]
      },
      select: {
        id: true,
        transaction_id: true,
        msisdn: true,
        payment_status: true,
        amount: true
      }
    })

    // Get payment IDs to check against token history
    const paymentIds = payments.map(p => p.id)

    // Fetch token history for these payments
    const tokenHistory = await prisma.token_history_data.findMany({
      where: {
        id: {
          in: paymentIds
        }
      },
      select: {
        id: true,
        luku: true
      }
    })

    // Create a Set of payment IDs that have valid tokens
    const paymentsWithValidTokens = new Set<number>()
    tokenHistory.forEach(token => {
      if (token.luku && isValidToken(token.luku)) {
        paymentsWithValidTokens.add(token.id)
      }
    })

    // Filter out payments that have valid tokens
    const unsuccessfulPayments = payments
      .filter(payment => !paymentsWithValidTokens.has(payment.id))
      .map(payment => ({
        TRANSACTION_ID: payment.transaction_id,
        MSISDN: payment.msisdn,
        STATUS: payment.payment_status,
        AMOUNT: payment.amount
      }))

    return NextResponse.json({
      payments: unsuccessfulPayments,
      total: unsuccessfulPayments.length
    })
  } catch (error) {
    console.error('Refund upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process uploaded data' },
      { status: 500 }
    )
  }
}
