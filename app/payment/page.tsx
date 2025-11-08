'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Pagination from '@/components/Pagination'
import SearchBar from '@/components/SearchBar'
import TableLoader from '@/components/TableLoader'
import { isValidToken } from '@/lib/utils'

interface Payment {
  id: number
  payment_method: string | null
  transaction_id: string | null
  amount: number | null
  msisdn: string | null
  customer_reference_id: string | null
  transaction_date: string | null
  payment_status: string | null
  payment_status_description: string | null
  token:                    string
  meter_type:              string
  token_data?: {
    id: number
    txn_id: string
    transaction_date: string
    invoice_id: number
    meter_id: number
    passcode: string
    luku: string
    units: string
  }
    //   transaction_type:        number
    //   company_name:            string
    //   customer_id:             number
    //   landlord_id:             number
    //   payment_source:          number
    //   payment_belongs:        number
}

interface PaginationData {
  currentPage: number
  totalPages: number
  totalCount: number
  limit: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export default function PaymentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [payments, setPayments] = useState<Payment[]>([])
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPreviousPage: false
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [openDropdown, setOpenDropdown] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isSending, setIsSending] = useState(false)

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  const fetchPayments = useCallback(async (
    page: number = 1, 
    search: string = '', 
    status: string = '', 
    limit: number = 10,
    date: string = '',
    paymentMethod: string = ''
  ) => {
    setIsLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(status && { status }),
        ...(date && { date }),
        ...(paymentMethod && { paymentMethod })
      })

      const response = await fetch(`/api/payment?${params}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to fetch payments')
      } else {
        setPayments(data.payments || [])
        setPagination(data.pagination)
      }
    } catch (error) {
      setError('Something went wrong')
        setPayments([])
        setPagination({
            currentPage: 1,
            totalPages: 1,
            totalCount: 0,
            limit: 10,
            hasNextPage: false,
            hasPreviousPage: false
        })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPayments(1, searchTerm, statusFilter, pageSize, dateFilter, paymentMethodFilter)
    }
  }, [status, searchTerm, statusFilter, pageSize, dateFilter, paymentMethodFilter, fetchPayments])

  const handlePageChange = (page: number) => {
    fetchPayments(page, searchTerm, statusFilter, pageSize, dateFilter, paymentMethodFilter)
  }

  const handleSearch = (search: string) => {
    setSearchTerm(search)
  }

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
  }

  const handleDateFilter = (date: string) => {
    setDateFilter(date)
  }

  const handlePaymentMethodFilter = (method: string) => {
    setPaymentMethodFilter(method)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
  }

  const handleRefresh = () => {
    fetchPayments(pagination.currentPage, searchTerm, statusFilter, pageSize, dateFilter, paymentMethodFilter)
  }

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000) // Auto-hide after 3 seconds
  }

  const handleCopySMSToken = (token: string) => {
    if (token) {
      navigator.clipboard.writeText(token).then(() => {
        showToast('SMS copied to clipboard!')
      }).catch(() => {
        showToast('Failed to copy SMS', 'error')
      })
    }
    setOpenDropdown(null)
  }

  const handleCopyTokens = (payment: Payment) => {
    const tokens: string[] = []
    if (payment.meter_type == "DOMESTIC") {
        if (payment.token_data?.luku) tokens.push(`MUHIMU SANA ANZA KUWEKA LUKU: \n${payment.token_data.luku}\n`)
        if (payment.token_data?.passcode) tokens.push(`MALIZIA KUWEKA PASSCODE: \n${payment.token_data.passcode}\n`)
        if (payment.customer_reference_id) tokens.push(`Mita # ${payment.customer_reference_id} \nRisiti: ${payment.transaction_id} \nKiasi: TZS ${payment.amount}`)
        if (payment.token_data?.units) tokens.push(`Units: ${payment.token_data.units}\n`)
        tokens.push(`** Tupigie Simu 0777901467 au 0750013030 **`)
    } else {
        if (payment.token_data?.passcode) tokens.push(`Token: ${payment.token_data.passcode} \nMeter # 0179002253443 \nReceipt: ${payment.transaction_id} \nAmount: ${payment.amount} \nUnits: ${payment.token_data.units}kWh \n\n**Contact Us 0750013030 or 0750013030 **`)
    }

    if (tokens.length > 0) {
      const tokenText = tokens.join('\n')
      navigator.clipboard.writeText(tokenText).then(() => {
        showToast('Tokens copied to clipboard!')
      }).catch(() => {
        showToast('Failed to copy tokens', 'error')
      })
    }
    setOpenDropdown(null)
  }

  const handleResendSMS = (payment: Payment) => {
    setSelectedPayment(payment)
    setPhoneNumber(payment.msisdn || '')
    setShowPhoneModal(true)
    setOpenDropdown(null)
  }

  const handleSendSMS = async () => {
    if (!selectedPayment) return

    if (!phoneNumber.trim()) {
      showToast('Please enter a phone number', 'error')
      return
    }

    // Validate phone number format
    const phone = phoneNumber.trim()
    let isValid = false
    let errorMessage = ''

    if (phone.startsWith('+255')) {
      // Format: +255XXXXXXXXX (13 characters total)
      if (phone.length === 13 && /^\+255[0-9]{9}$/.test(phone)) {
        isValid = true
      } else {
        errorMessage = 'Invalid PhoneNumber. Use +255 followed by 9 digits (13 characters total)'
      }
    } else if (phone.startsWith('255')) {
      // Format: 255XXXXXXXXX (12 characters total)
      if (phone.length === 12 && /^255[0-9]{9}$/.test(phone)) {
        isValid = true
      } else {
        errorMessage = 'Invalid PhoneNumber. Use 255 followed by 9 digits (12 characters total)'
      }
    } else if (phone.startsWith('0')) {
      // Format: 0XXXXXXXXX (10 characters total)
      if (phone.length === 10 && /^0[0-9]{9}$/.test(phone)) {
        isValid = true
      } else {
        errorMessage = 'Invalid PhoneNumber. Use 0 followed by 9 digits (10 characters total)'
      }
    } else {
      errorMessage = 'Phone number must start with +255, 255, or 0'
    }

    if (!isValid) {
      showToast(errorMessage, 'error')
      return
    }

    setIsSending(true)

    try {
      // Build the SMS message
      let message = ''
      if (selectedPayment.meter_type === "DOMESTIC") {
        if (selectedPayment.token_data?.luku) message += `MUHIMU SANA ANZA KUWEKA LUKU: \n${selectedPayment.token_data.luku}\n\n`
        if (selectedPayment.token_data?.passcode) message += `MALIZIA KUWEKA PASSCODE: \n${selectedPayment.token_data.passcode}\n\n`
        if (selectedPayment.customer_reference_id) message += `Mita # ${selectedPayment.customer_reference_id} \nRisiti: ${selectedPayment.transaction_id} \nKiasi: TZS ${selectedPayment.amount}`
        if (selectedPayment.token_data?.units) message += `\nUnits: ${selectedPayment.token_data.units}\n\n`
        message += `** Tupigie Simu 0777901467 au 0750013030 **`
      } else {
        if (selectedPayment.token_data?.passcode) {
          message = `Token: ${selectedPayment.token_data.passcode} \nMeter # ${selectedPayment.customer_reference_id} \nReceipt: ${selectedPayment.transaction_id} \nAmount: ${selectedPayment.amount} \nUnits: ${selectedPayment.token_data.units}kWh \n\n**Contact Us 0750013030 or 0750013030 **`
        }
      }

      if (!message) {
        showToast('No token data available to send', 'error')
        setIsSending(false)
        return
      }

      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          message: message
        })
      })

      const data = await response.json()

      if (!response.ok) {
        showToast(data.error || 'Failed to send SMS', 'error')
      } else {
        showToast('SMS sent successfully!')
        setShowPhoneModal(false)
        setPhoneNumber('')
        setSelectedPayment(null)
      }
    } catch (error) {
      console.error('Error sending SMS:', error)
      showToast('Failed to send SMS', 'error')
    } finally {
      setIsSending(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    router.push('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] animate-slide-in-right">
          <div className={`rounded-lg shadow-lg p-4 max-w-sm ${
            toast.type === 'success' 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <p className={`text-sm font-medium ${
                toast.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {toast.message}
              </p>
              <button
                onClick={() => setToast(null)}
                className="ml-auto pl-3"
              >
                <svg className={`w-4 h-4 ${
                  toast.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-md rounded-lg overflow-visible">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Payment History</h2>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg 
                  className={`-ml-1 mr-2 h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                  />
                </svg>
                <span className='hidden md:inline'>Refresh</span>
              </button>
            </div>
            
            {/* Search and Filter Section */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-4">
                <div className="flex-1">
                  <SearchBar 
                    onSearch={handleSearch}
                    placeholder="Search by Transaction ID, MSISDN, or Reference..."
                  />
                </div>
                
                <div className="flex flex-col md:flex-row gap-4">
                  {/* <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => handleDateFilter(e.target.value)}
                    className="block w-full md:w-auto rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    title="Filter by date"
                  /> */}

                  <select
                    value={paymentMethodFilter}
                    onChange={(e) => handlePaymentMethodFilter(e.target.value)}
                    className="block w-full md:w-auto md:min-w-[150px] rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    <option value="">All Methods</option>
                    <option value="M-PESA">M-PESA</option>
                    <option value="TIGO-PESA">TIGO-PESA</option>
                    <option value="AIRTEL-MONEY">AIRTEL-MONEY</option>
                    <option value="SELCOM">SELCOM</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusFilter(e.target.value)}
                    className="block w-full md:w-auto md:min-w-[150px] rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    <option value="">All Statuses</option>
                    <option value="SUCCESFUL" disabled>Success</option>
                    <option value="NOT SUCCESFUL" disabled>Failed</option>
                  </select>

                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="block w-full md:w-auto md:min-w-[120px] rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={30}>30 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                </div>
              </div>
              
              {/* Results count */}
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  Showing {payments.length} of {pagination.totalCount} payments
                </span>
                {(searchTerm || statusFilter || dateFilter || paymentMethodFilter) && (
                  <button
                    onClick={() => {
                      setSearchTerm('')
                      setStatusFilter('')
                      setDateFilter('')
                      setPaymentMethodFilter('')
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
            
            {error && (
              <div className="rounded-md bg-red-50 p-4 mb-6">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {isLoading ? (
              <TableLoader columns={6} rows={10} />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr className='uppercase'>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Transaction ID
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Meter Number
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Phone Number
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          SMS Token
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tokens
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date/Amount
                        </th>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center">
                            <svg 
                              className="mx-auto h-12 w-12 text-gray-400" 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                              />
                            </svg>
                            <p className="mt-2 text-sm text-gray-500">
                              {searchTerm || statusFilter ? 'No payments found matching your filters' : 'No payment records found'}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        payments.map((payment, index) => (
                          <tr key={payment.id} className="hover:bg-gray-50">
                            <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                              <p className="text-sm font-medium">{payment.transaction_id || 'N/A'}</p>
                              {payment.payment_status === 'SUCCESFUL' || isValidToken(payment.token_data?.luku) ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-50 text-green-500">
                                SUCCESSFUL
                              </span> : payment.payment_status === 'NOT SUCCESFUL' ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-50 text-red-500">
                                NOT SUCCESSFUL
                              </span> : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-50 text-purple-500">
                                PENDING
                              </span>}
                            </td>
                            <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                                <p className="text-sm font-medium">{payment.customer_reference_id}</p>
                                <p className="text-xs text-gray-500">{payment.meter_type}</p>
                            </td>
                            <td className="px-2 py-4 whitespace-nowrap text-gray-900">
                              <p className="text-sm font-medium">{payment.msisdn || ''}</p>
                              <p className="text-xs text-gray-500">{payment.payment_method || 'N/A'}</p>
                            </td>
                            <td className="px-2 py-4 text-sm text-gray-500 min-w-72">
                              {payment.token || ''}
                            </td>
                            <td className="px-2 py-4 text-sm text-gray-500 min-w-72">
                              {payment.token_data?.passcode && <p className="text-sm font-medium">P: {payment.token_data.passcode || ''}</p>}
                              {payment.token_data?.luku && <p className="text-sm font-medium">L: {payment.token_data.luku || ''}</p>}
                            </td>
                            <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                              {payment.transaction_date || 'N/A'}
                              <p className="text-xs text-gray-500">{payment.amount ? `TZS ${payment.amount.toLocaleString()}` : ''} {payment.token_data?.units ? `(${payment.token_data.units} units)` : ''}</p>
                            </td>
                            <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              <div className="relative">
                                <button
                                  onClick={() => setOpenDropdown(openDropdown === payment.id ? null : payment.id)}
                                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                  title="Actions"
                                >
                                  <svg 
                                    className="w-5 h-5 text-gray-600" 
                                    fill="currentColor" 
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                  </svg>
                                </button>
                                
                                {openDropdown === payment.id && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-10" 
                                      onClick={() => setOpenDropdown(null)}
                                    ></div>
                                    <div className={`absolute right-0 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 ${
                                      index >= payments.length - 2 ? 'bottom-full mb-2' : 'mt-2'
                                    }`}>
                                      <div className="py-1">
                                        {(payment.token?.startsWith("Token:") || payment.token.startsWith("MUHIMU")) && <button
                                          onClick={() => handleCopySMSToken(payment.token)}
                                          disabled={!payment.token}
                                          className={`block w-full text-left px-4 py-2 text-sm ${
                                            payment.token 
                                              ? 'text-gray-700 hover:bg-gray-100' 
                                              : 'text-gray-400 cursor-not-allowed'
                                          }`}
                                        >
                                          <div className="flex items-center">
                                            <svg 
                                              className="w-4 h-4 mr-2" 
                                              fill="none" 
                                              stroke="currentColor" 
                                              viewBox="0 0 24 24"
                                            >
                                              <path 
                                                strokeLinecap="round" 
                                                strokeLinejoin="round" 
                                                strokeWidth={2} 
                                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" 
                                              />
                                            </svg>
                                            Copy SMS Token
                                          </div>
                                        </button>}
                                        {payment.token_data?.passcode &&<button
                                          onClick={() => handleCopyTokens(payment)}
                                          disabled={!payment.token_data?.passcode && !payment.token_data?.luku}
                                          className={`block w-full text-left px-4 py-2 text-sm ${
                                            payment.token_data?.passcode || payment.token_data?.luku
                                              ? 'text-gray-700 hover:bg-gray-100' 
                                              : 'text-gray-400 cursor-not-allowed'
                                          }`}
                                        >
                                          <div className="flex items-center">
                                            <svg
                                              className="w-4 h-4 mr-2" 
                                              fill="none" 
                                              stroke="currentColor" 
                                              viewBox="0 0 24 24"
                                            >
                                              <path 
                                                strokeLinecap="round" 
                                                strokeLinejoin="round" 
                                                strokeWidth={2} 
                                                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" 
                                              />
                                            </svg>
                                            Copy Tokens as SMS
                                          </div>
                                        </button>}
                                        <button
                                          onClick={() => handleResendSMS(payment)}
                                          disabled={!payment.token_data?.passcode && !payment.token_data?.luku}
                                          className={`block w-full text-left px-4 py-2 text-sm ${
                                            payment.token_data?.passcode || payment.token_data?.luku
                                              ? 'text-gray-700 hover:bg-gray-100' 
                                              : 'text-gray-400 cursor-not-allowed'
                                          }`}
                                        >
                                          <div className="flex items-center">
                                            <svg 
                                              className="w-4 h-4 mr-2" 
                                              fill="none" 
                                              stroke="currentColor" 
                                              viewBox="0 0 24 24"
                                            >
                                              <path 
                                                strokeLinecap="round" 
                                                strokeLinejoin="round" 
                                                strokeWidth={2} 
                                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
                                              />
                                            </svg>
                                            Resend SMS
                                          </div>
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <Pagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    onPageChange={handlePageChange}
                  />
                )}
              </>
            )}
          </div>

        </div>

        {/* Phone Number Modal */}
        {showPhoneModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto text-gray-900">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div 
                className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
                onClick={() => {
                  setShowPhoneModal(false)
                  setPhoneNumber('')
                  setSelectedPayment(null)
                }}
              ></div>

              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                      <svg 
                        className="h-6 w-6 text-blue-600" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
                        />
                      </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Resend SMS
                      </h3>
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 mb-4">
                          Enter the phone number to send the SMS to. The default number from the payment record is pre-filled.
                        </p>
                        <div>
                          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                            Phone Number
                          </label>
                          <input
                            type="text"
                            id="phone"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="255XXXXXXXXX, +255XXXXXXXXX, or 07XXXXXXXX"
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2 border"
                          />
                          <p className="mt-2 text-xs text-gray-500">
                            Formats: 255 (12 chars), +255 (13 chars), or 0 (10 chars)
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Transaction: {selectedPayment?.transaction_id}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={handleSendSMS}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      'Send SMS'
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => {
                      setShowPhoneModal(false)
                      setPhoneNumber('')
                      setSelectedPayment(null)
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
