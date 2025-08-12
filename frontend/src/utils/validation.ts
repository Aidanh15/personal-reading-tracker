export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  custom?: (value: any) => string | null;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  fieldErrors: Record<string, string>;
}

export const validateField = (
  fieldName: string,
  value: any,
  rules: ValidationRule
): string | null => {
  // Required validation
  if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return `${fieldName} is required`;
  }

  // Skip other validations if field is empty and not required
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  // String validations
  if (typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      return `${fieldName} must be at least ${rules.minLength} characters long`;
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      return `${fieldName} must be no more than ${rules.maxLength} characters long`;
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      return `${fieldName} format is invalid`;
    }
  }

  // Number validations
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (typeof numValue === 'number' && !isNaN(numValue)) {
    if (rules.min !== undefined && numValue < rules.min) {
      return `${fieldName} must be at least ${rules.min}`;
    }

    if (rules.max !== undefined && numValue > rules.max) {
      return `${fieldName} must be no more than ${rules.max}`;
    }
  }

  // Custom validation
  if (rules.custom) {
    return rules.custom(value);
  }

  return null;
};

export const validateForm = (
  data: Record<string, any>,
  rules: Record<string, ValidationRule>
): FormValidationResult => {
  const errors: ValidationError[] = [];
  const fieldErrors: Record<string, string> = {};

  Object.entries(rules).forEach(([fieldName, fieldRules]) => {
    const value = data[fieldName];
    const error = validateField(fieldName, value, fieldRules);
    
    if (error) {
      errors.push({ field: fieldName, message: error });
      fieldErrors[fieldName] = error;
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
  };
};

// Common validation patterns
export const validationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\/.+/,
  isbn: /^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/,
  positiveInteger: /^[1-9]\d*$/,
  percentage: /^(100|[1-9]?\d)$/,
};

// Common validation rules
export const commonRules = {
  required: { required: true },
  email: { 
    required: true, 
    pattern: validationPatterns.email 
  },
  url: { 
    pattern: validationPatterns.url 
  },
  bookTitle: {
    required: true,
    minLength: 1,
    maxLength: 500,
  },
  authorName: {
    required: true,
    minLength: 1,
    maxLength: 200,
  },
  highlightText: {
    required: true,
    minLength: 1,
    maxLength: 5000,
  },
  pageNumber: {
    min: 1,
    max: 10000,
    custom: (value: any) => {
      if (value && !Number.isInteger(Number(value))) {
        return 'Page number must be a whole number';
      }
      return null;
    },
  },
  progressPercentage: {
    min: 0,
    max: 100,
    custom: (value: any) => {
      if (value && !Number.isInteger(Number(value))) {
        return 'Progress must be a whole number';
      }
      return null;
    },
  },
  rating: {
    min: 1,
    max: 5,
    custom: (value: any) => {
      if (value && !Number.isInteger(Number(value))) {
        return 'Rating must be a whole number';
      }
      return null;
    },
  },
};