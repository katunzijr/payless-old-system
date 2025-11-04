import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// Get payment history from tbl_mobile_payments
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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    
    // Calculate skip for pagination
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    // Search across multiple fields
    if (search) {
      where.OR = [
          { customer_reference_id: { contains: search } },
          { msisdn: { contains: search } },
          { transaction_id: { contains: search } },
      ]
    }
    
    // Filter by status
    if (status) {
      where.payment_status = status
    }

    // Get total count for pagination
    const totalCount = await prisma.tbl_mobile_payments.count({ where })

    // Fetch payments from tbl_mobile_payments
    const payments = await prisma.tbl_mobile_payments.findMany({
      where,
      orderBy: {
        id: 'desc'
      },
      skip,
      take: limit
    })

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    return NextResponse.json({
      payments,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPreviousPage
      }
    })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}
