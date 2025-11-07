import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { smsService } from '@/lib/sms'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { phoneNumber, message } = body

    // Validate input
    if (!phoneNumber || !message) {
      return NextResponse.json(
        { error: 'Phone number and message are required' },
        { status: 400 }
      )
    }

    // Validate phone number format (basic validation)
    const cleanPhoneNumber = phoneNumber.replace(/\s+/g, '').trim()
    if (!/^\+?[0-9]{10,15}$/.test(cleanPhoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    console.log('Sending SMS to:', cleanPhoneNumber)

    // Send SMS using the SMS service
    const result = await smsService.sendSMS({
      to: cleanPhoneNumber,
      message: message
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || 'Failed to send SMS' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'SMS sent successfully',
      data: result.data
    })

  } catch (error) {
    console.error('Error sending SMS:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
