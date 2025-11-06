'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

interface RefundPayment {
  TRANSACTION_ID: string | null
  MSISDN: string | null
  STATUS: string | null
  AMOUNT: number | null
}

interface UploadedRow {
  [key: string]: any
  isUnsuccessful?: boolean
}

type TabType = 'date-range' | 'upload'

export default function RefundPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('date-range')
  
  // Date Range Tab State
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  
  // Upload Tab State
  const [uploadPaymentMethod, setUploadPaymentMethod] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedData, setUploadedData] = useState<UploadedRow[]>([])
  
  // Common State
  const [payments, setPayments] = useState<RefundPayment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)

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

  const fetchRefundData = async () => {
    if (!startDate || !endDate || !paymentMethod) {
      setError('Please fill all fields')
      return
    }

    setIsLoading(true)
    setError('')
    setShowPreview(false)

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        paymentMethod,
      })

      const response = await fetch(`/api/refund?${params}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to fetch refund data')
        setPayments([])
      } else {
        setPayments(data.payments || [])
        setShowPreview(true)
      }
    } catch (error) {
      setError('Something went wrong')
      setPayments([])
    } finally {
      setIsLoading(false)
    }
  }

  const downloadExcel = () => {
    if (payments.length === 0) {
      setError('No data to download')
      return
    }

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(payments)
    
    // Create workbook
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Refunds')

    // Generate filename
    const method = activeTab === 'date-range' ? paymentMethod : uploadPaymentMethod
    const filename = activeTab === 'date-range' 
      ? `refunds_${paymentMethod}_${startDate}_${endDate}.xlsx`
      : `refunds_${uploadPaymentMethod}_upload.xlsx`

    // Download
    XLSX.writeFile(workbook, filename)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    const validExtensions = ['xlsx', 'xls', 'csv']
    
    if (!fileExtension || !validExtensions.includes(fileExtension)) {
      setError('Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.')
      return
    }

    setUploadedFile(file)
    setUploadedData([])
    setError('')
    setShowPreview(false)
  }

  const processUploadedFile = async () => {
    if (!uploadedFile || !uploadPaymentMethod) {
      setError('Please select a payment method and upload a file')
      return
    }

    setIsLoading(true)
    setError('')
    setShowPreview(false)

    try {
      let jsonData: any[] = []
      const fileExtension = uploadedFile.name.split('.').pop()?.toLowerCase()

      if (fileExtension === 'csv') {
        // Read CSV file
        const text = await uploadedFile.text()
        const workbook = XLSX.read(text, { type: 'string' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        jsonData = XLSX.utils.sheet_to_json(worksheet)
      } else {
        // Read Excel file (.xlsx, .xls)
        const data = await uploadedFile.arrayBuffer()
        const workbook = XLSX.read(data)
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        jsonData = XLSX.utils.sheet_to_json(worksheet)
      }

      if (jsonData.length === 0) {
        setError('The uploaded file is empty')
        setIsLoading(false)
        return
      }

      // Extract transaction IDs based on payment method
      let transactionIds: string[] = []
      
      if (uploadPaymentMethod === 'M-PESA') {
        // M-PESA column template (adjust based on actual template)
        transactionIds = jsonData.map((row: any) => {
          const id = row['ORDERID'] || row['orderid']
          return id ? String(id).trim() : null
        }).filter(Boolean) as string[]
      } else if (uploadPaymentMethod === 'TIGO-PESA') {
        // TIGO-PESA column template (adjust based on actual template)
        transactionIds = jsonData.map((row: any) => {
          const id = row['SALES_ORDER_NUMBER'] || row['sales_order_number']
          return id ? String(id).trim() : null
        }).filter(Boolean) as string[]
      }

      if (transactionIds.length === 0) {
        setError('No transaction IDs found in the uploaded file')
        setIsLoading(false)
        return
      }

      // Send to API to check which ones are unsuccessful
      const response = await fetch('/api/refund/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionIds,
          paymentMethod: uploadPaymentMethod
        })
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to process uploaded file')
        setPayments([])
        setUploadedData([])
      } else {
        // Get unsuccessful transaction IDs
        const unsuccessfulIds = new Set(
          result.payments.map((p: RefundPayment) => p.TRANSACTION_ID)
        )

        // Mark rows as unsuccessful or successful
        const markedData = jsonData.map((row: any) => {
          let transactionId = ''
          if (uploadPaymentMethod === 'M-PESA') {
            transactionId = String(row['ORDERID'] || row['orderid'] || '').trim()
          } else if (uploadPaymentMethod === 'TIGO-PESA') {
            transactionId = String(row['SALES_ORDER_NUMBER'] || row['sales_order_number'] || '').trim()
          }
          
          return {
            ...row,
            isUnsuccessful: unsuccessfulIds.has(transactionId)
          }
        })

        setUploadedData(markedData)
        setPayments(result.payments || [])
        setShowPreview(true)
      }
    } catch (error) {
      setError('Error processing file')
      setPayments([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Refund Export</h2>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => {
                    setActiveTab('date-range')
                    setShowPreview(false)
                    setError('')
                    setPayments([])
                    setUploadedData([])
                  }}
                  className={`${
                    activeTab === 'date-range'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Date Range Export
                </button>
                <button
                  onClick={() => {
                    setActiveTab('upload')
                    setShowPreview(false)
                    setError('')
                    setPayments([])
                    setUploadedData([])
                  }}
                  className={`${
                    activeTab === 'upload'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Upload File
                </button>
              </nav>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4 mb-6">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Tab Content */}
            {activeTab === 'date-range' ? (
              // Date Range Tab Content
              <div className="mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="block w-full rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      required 
                    >
                      <option value="">Select Method</option>
                      <option value="M-PESA">M-PESA</option>
                      <option value="TIGO-PESA">TIGO-PESA</option>
                      <option value="AIRTEL-MONEY">AIRTEL-MONEY</option>
                      <option value="SELCOM" disabled>SELCOM</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={fetchRefundData}
                      disabled={isLoading}
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Loading...' : 'Preview'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // Upload File Tab Content
              <div className="mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method
                    </label>
                    <select
                      value={uploadPaymentMethod}
                      onChange={(e) => setUploadPaymentMethod(e.target.value)}
                      className="block w-full rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      required 
                    >
                      <option value="">Select Method</option>
                      <option value="M-PESA">M-PESA</option>
                      <option value="TIGO-PESA">TIGO-PESA</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Only M-PESA and TIGO-PESA are supported for upload
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload File
                    </label>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="block w-full text-sm text-gray-900 border border-gray-300 rounded-md cursor-pointer bg-gray-50 focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {uploadedFile ? uploadedFile.name : 'No file selected'}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Accepted formats: Excel (.xlsx, .xls) or CSV (.csv)
                    </p>
                  </div>
                </div>

                <div>
                  <button
                    onClick={processUploadedFile}
                    disabled={isLoading || !uploadedFile || !uploadPaymentMethod}
                    className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Processing...' : 'Process File'}
                  </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">File Requirements:</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• <strong>Format:</strong> Excel (.xlsx, .xls) or CSV (.csv)</li>
                    <li>• <strong>M-PESA:</strong> Must have column named ORDERID or orderid</li>
                    <li>• <strong>TIGO-PESA:</strong> Must have column named SALES_ORDER_NUMBER or sales_order_number</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Preview Section */}
            {showPreview && (
              <>
                <div className="flex items-center justify-between mb-4 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    {activeTab === 'upload' ? (
                      <>
                        Total Rows: <span className="font-semibold">{uploadedData.length}</span>
                        {' | '}
                        Unsuccessful: <span className="font-semibold text-red-600">{payments.length}</span>
                      </>
                    ) : (
                      <>
                        Total Records: <span className="font-semibold">{payments.length}</span>
                      </>
                    )}
                  </p>
                  <button
                    onClick={downloadExcel}
                    disabled={payments.length === 0}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg 
                      className="-ml-1 mr-2 h-5 w-5" 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
                      />
                    </svg>
                    Download Excel
                  </button>
                </div>

                {activeTab === 'upload' && uploadedData.length > 0 ? (
                  // Upload Tab - Show original Excel data with unsuccessful rows highlighted
                  <div className="overflow-x-auto">
                    <div className="mb-2 text-xs text-gray-600 flex items-center gap-2">
                      <span className="inline-flex items-center">
                        <span className="w-4 h-4 bg-red-100 border border-red-300 mr-1"></span>
                        Unsuccessful payments (will be exported)
                      </span>
                      <span className="inline-flex items-center ml-4">
                        <span className="w-4 h-4 bg-white border border-gray-300 mr-1"></span>
                        Successful or not found
                      </span>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {uploadedData.length > 0 && Object.keys(uploadedData[0])
                            .filter(key => key !== 'isUnsuccessful')
                            .map((header, index) => (
                              <th 
                                key={index}
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                {header}
                              </th>
                            ))
                          }
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {uploadedData.map((row, rowIndex) => (
                          <tr 
                            key={rowIndex} 
                            className={row.isUnsuccessful ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}
                          >
                            {Object.entries(row)
                              .filter(([key]) => key !== 'isUnsuccessful')
                              .map(([key, value], cellIndex) => (
                                <td 
                                  key={cellIndex}
                                  className={`px-6 py-4 whitespace-nowrap text-sm ${
                                    row.isUnsuccessful ? 'text-gray-900 font-medium' : 'text-gray-700'
                                  }`}
                                >
                                  {value !== null && value !== undefined ? String(value) : ''}
                                </td>
                              ))
                            }
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  // Date Range Tab - Show standard refund data
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            TRANSACTION_ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            MSISDN
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            STATUS
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            AMOUNT
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {payments.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center">
                              <p className="text-sm text-gray-500">
                                No unsuccessful payments found
                              </p>
                            </td>
                          </tr>
                        ) : (
                          payments.map((payment, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {payment.TRANSACTION_ID || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {payment.MSISDN || ''}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                  {payment.STATUS || 'UNKNOWN'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {payment.AMOUNT ? `${payment.AMOUNT.toLocaleString()}` : ''}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
