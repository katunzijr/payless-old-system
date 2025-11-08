import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isValidToken } from '@/lib/utils'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Get unsuccessful payments for refund export
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const paymentMethod = searchParams.get('paymentMethod')

    if (!startDate || !endDate || !paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Convert dates to proper format for comparison
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    // Build where clause for unsuccessful payments
    const where: any = {
      payment_method: paymentMethod,
      payment_status: 'NOT SUCCESFUL',
      AND: [
        {
          transaction_id: {
            not: {
                startsWith: "PAYLESS"
            }
          }
        },
        {
          transaction_id: {
            not: ''
          }
        },
      ],
      // Filter by date range (transaction_date is stored as string)
      transaction_date: {
        gte: start.toISOString().split('T')[0],
        lte: end.toISOString().split('T')[0]
      }
    }

    // Fetch unsuccessful payments
    const payments = await prisma.tbl_mobile_payments.findMany({
      where,
      select: {
        transaction_id: true,
        msisdn: true,
        payment_status: true,
        amount: true
      },
    })

    // Get transaction IDs to fetch token data
    const transactionIds = payments
      .map(p => p.transaction_id)
      .filter((id): id is string => id !== null)

    // Fetch token history data (only id and luku fields)
    const tokenData = await prisma.token_history_data.findMany({
      where: {
        txn_id: {
          in: transactionIds
        }
      },
      select: {
        txn_id: true,
        luku: true,
        passcode: true
      }
    })

    // Create a map for quick lookup
    const tokenMap = new Map(tokenData.map(t => [t.txn_id, t]))

    // Filter out payments that have valid tokens (treated as successful)
    const unsuccessfulPayments = payments.filter(payment => {
      const token = payment.transaction_id ? tokenMap.get(payment.transaction_id) : null
      // If payment has a valid token, exclude it (it's considered successful)
      if (token?.luku && isValidToken(token.luku)) {
        return false
      }
      if (token?.passcode && isValidToken(token.passcode)) {
        return false
      }
      return true
    })

    // Format the response
    const formattedPayments = unsuccessfulPayments.map(payment => ({
      TRANSACTION_ID: payment.transaction_id || 'N/A',
      MSISDN: payment.msisdn || '',
      STATUS: payment.payment_status || 'PENDING',
      AMOUNT: payment.amount || 0,
    }))

    return NextResponse.json({
      payments: formattedPayments,
      count: formattedPayments.length
    })
  } catch (error) {
    console.error('Error fetching refund data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch refund data' },
      { status: 500 }
    )
  }
}
