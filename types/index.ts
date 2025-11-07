// Re-export all feature types  

// Validation error types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Common API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
  errors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

export interface PaginatedResponse<T = any> extends Omit<ApiResponse<T[]>, 'pagination'> {
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface HealthCheck {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  database?: {
    status: string;
    type: string;
  };
}

export type SortOrder = 'asc' | 'desc';

export interface ErrorResponse {
  error: string;
  message: string;
  status?: number;
  stack?: string;
}