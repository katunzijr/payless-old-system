'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Pagination from '@/components/Pagination'
import SearchBar from '@/components/SearchBar'
import TableLoader from '@/components/TableLoader'

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
  const [pageSize, setPageSize] = useState(10)

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  const fetchPayments = useCallback(async (page: number = 1, search: string = '', status: string = '', limit: number = 10) => {
    setIsLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(status && { status })
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
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPayments(1, searchTerm, statusFilter, pageSize)
    }
  }, [status, searchTerm, statusFilter, pageSize, fetchPayments])

  const handlePageChange = (page: number) => {
    fetchPayments(page, searchTerm, statusFilter, pageSize)
  }

  const handleSearch = (search: string) => {
    setSearchTerm(search)
  }

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
  }

  const handleRefresh = () => {
    fetchPayments(pagination.currentPage, searchTerm, statusFilter, pageSize)
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
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
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
                Refresh
              </button>
            </div>
            
            {/* Search and Filter Section */}
            <div className="mb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SearchBar 
                  onSearch={handleSearch}
                  placeholder="Search by Transaction ID, MSISDN, or Reference..."
                />
                
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusFilter(e.target.value)}
                  className="block w-full rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                >
                  <option value="">All Statuses</option>
                  <option value="SUCCESFUL">Success</option>
                  <option value="NOT SUCCESFUL">Failed</option>
                </select>

                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="block w-full rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={30}>30 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
              
              {/* Results count */}
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  Showing {payments.length} of {pagination.totalCount} payments
                </span>
                {(searchTerm || statusFilter) && (
                  <button
                    onClick={() => {
                      setSearchTerm('')
                      setStatusFilter('')
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Transaction ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Meter Number
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Phone Number
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          SMS Token
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
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
                        payments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <p className="text-sm font-medium">{payment.transaction_id || 'N/A'}</p>
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                payment.payment_status === 'success'
                                  ? 'bg-green-50 text-green-500'
                                  : 'bg-red-50 text-red-400'
                              }`}>
                                {payment.payment_status || 'UNKNOWN'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <p className="text-sm font-medium">{payment.customer_reference_id}</p>
                                <p className="text-xs text-gray-500">{payment.meter_type}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                              <p className="text-sm font-medium">{payment.msisdn || 'N/A'}</p>
                              <p className="text-xs text-gray-500">{payment.payment_method || 'N/A'}</p>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 min-w-72">
                              {payment.token || ''}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {payment.amount ? `TZS ${payment.amount.toLocaleString()}` : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {payment.transaction_date || 'N/A'}
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
      </div>
    </div>
  )
}
