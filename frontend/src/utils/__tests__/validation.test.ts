import {
  validateField,
  validateForm,
  validationPatterns,
  commonRules,
  ValidationRule,
} from '../validation';

describe('validateField', () => {
  it('validates required fields', () => {
    const rule: ValidationRule = { required: true };

    expect(validateField('Name', '', rule)).toBe('Name is required');
    expect(validateField('Name', '   ', rule)).toBe('Name is required');
    expect(validateField('Name', null, rule)).toBe('Name is required');
    expect(validateField('Name', undefined, rule)).toBe('Name is required');
    expect(validateField('Name', 'John', rule)).toBeNull();
  });

  it('validates string length', () => {
    const rule: ValidationRule = { minLength: 3, maxLength: 10 };

    expect(validateField('Name', 'Jo', rule)).toBe('Name must be at least 3 characters long');
    expect(validateField('Name', 'John', rule)).toBeNull();
    expect(validateField('Name', 'Very long name', rule)).toBe('Name must be no more than 10 characters long');
  });

  it('validates patterns', () => {
    const rule: ValidationRule = { pattern: /^[A-Z][a-z]+$/ };

    expect(validateField('Name', 'john', rule)).toBe('Name format is invalid');
    expect(validateField('Name', 'JOHN', rule)).toBe('Name format is invalid');
    expect(validateField('Name', 'John', rule)).toBeNull();
  });

  it('validates number ranges', () => {
    const rule: ValidationRule = { min: 1, max: 100 };

    expect(validateField('Age', 0, rule)).toBe('Age must be at least 1');
    expect(validateField('Age', 101, rule)).toBe('Age must be no more than 100');
    expect(validateField('Age', 50, rule)).toBeNull();
  });

  it('validates custom rules', () => {
    const rule: ValidationRule = {
      custom: (value) => value === 'forbidden' ? 'This value is not allowed' : null
    };

    expect(validateField('Value', 'forbidden', rule)).toBe('This value is not allowed');
    expect(validateField('Value', 'allowed', rule)).toBeNull();
  });

  it('skips validation for empty non-required fields', () => {
    const rule: ValidationRule = { minLength: 5, pattern: /^[A-Z]/ };

    expect(validateField('Optional', '', rule)).toBeNull();
    expect(validateField('Optional', null, rule)).toBeNull();
    expect(validateField('Optional', undefined, rule)).toBeNull();
  });

  it('validates required fields with other rules', () => {
    const rule: ValidationRule = { required: true, minLength: 3 };

    expect(validateField('Name', '', rule)).toBe('Name is required');
    expect(validateField('Name', 'Jo', rule)).toBe('Name must be at least 3 characters long');
    expect(validateField('Name', 'John', rule)).toBeNull();
  });
});

describe('validateForm', () => {
  it('validates entire form', () => {
    const data = {
      name: 'John',
      email: 'john@example.com',
      age: 25,
    };

    const rules = {
      name: { required: true, minLength: 2 },
      email: { required: true, pattern: validationPatterns.email },
      age: { required: true, min: 18, max: 100 },
    };

    const result = validateForm(data, rules);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.fieldErrors).toEqual({});
  });

  it('returns validation errors', () => {
    const data = {
      name: '',
      email: 'invalid-email',
      age: 15,
    };

    const rules = {
      name: { required: true },
      email: { required: true, pattern: validationPatterns.email },
      age: { min: 18 },
    };

    const result = validateForm(data, rules);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(3);
    expect(result.fieldErrors).toEqual({
      name: 'name is required',
      email: 'email format is invalid',
      age: 'age must be at least 18',
    });
  });

  it('handles missing fields', () => {
    const data = {
      name: 'John',
    };

    const rules = {
      name: { required: true },
      email: { required: true },
    };

    const result = validateForm(data, rules);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.fieldErrors['email']).toBe('email is required');
  });
});

describe('validationPatterns', () => {
  it('validates email pattern', () => {
    expect(validationPatterns.email.test('user@example.com')).toBe(true);
    expect(validationPatterns.email.test('user.name@example.co.uk')).toBe(true);
    expect(validationPatterns.email.test('invalid-email')).toBe(false);
    expect(validationPatterns.email.test('user@')).toBe(false);
    expect(validationPatterns.email.test('@example.com')).toBe(false);
  });

  it('validates URL pattern', () => {
    expect(validationPatterns.url.test('https://example.com')).toBe(true);
    expect(validationPatterns.url.test('http://example.com')).toBe(true);
    expect(validationPatterns.url.test('ftp://example.com')).toBe(false);
    expect(validationPatterns.url.test('example.com')).toBe(false);
  });

  it('validates positive integer pattern', () => {
    expect(validationPatterns.positiveInteger.test('1')).toBe(true);
    expect(validationPatterns.positiveInteger.test('123')).toBe(true);
    expect(validationPatterns.positiveInteger.test('0')).toBe(false);
    expect(validationPatterns.positiveInteger.test('-1')).toBe(false);
    expect(validationPatterns.positiveInteger.test('1.5')).toBe(false);
  });

  it('validates percentage pattern', () => {
    expect(validationPatterns.percentage.test('0')).toBe(true);
    expect(validationPatterns.percentage.test('50')).toBe(true);
    expect(validationPatterns.percentage.test('100')).toBe(true);
    expect(validationPatterns.percentage.test('101')).toBe(false);
    expect(validationPatterns.percentage.test('-1')).toBe(false);
  });
});

describe('commonRules', () => {
  it('provides book title validation', () => {
    expect(validateField('Title', '', commonRules.bookTitle)).toBe('Title is required');
    expect(validateField('Title', 'A'.repeat(501), commonRules.bookTitle)).toBe('Title must be no more than 500 characters long');
    expect(validateField('Title', 'Valid Title', commonRules.bookTitle)).toBeNull();
  });

  it('provides page number validation', () => {
    expect(validateField('Page', 0, commonRules.pageNumber)).toBe('Page must be at least 1');
    expect(validateField('Page', 10001, commonRules.pageNumber)).toBe('Page must be no more than 10000');
    expect(validateField('Page', 1.5, commonRules.pageNumber)).toBe('Page number must be a whole number');
    expect(validateField('Page', 100, commonRules.pageNumber)).toBeNull();
  });

  it('provides progress percentage validation', () => {
    expect(validateField('Progress', -1, commonRules.progressPercentage)).toBe('Progress must be at least 0');
    expect(validateField('Progress', 101, commonRules.progressPercentage)).toBe('Progress must be no more than 100');
    expect(validateField('Progress', 50.5, commonRules.progressPercentage)).toBe('Progress must be a whole number');
    expect(validateField('Progress', 75, commonRules.progressPercentage)).toBeNull();
  });

  it('provides rating validation', () => {
    expect(validateField('Rating', 0, commonRules.rating)).toBe('Rating must be at least 1');
    expect(validateField('Rating', 6, commonRules.rating)).toBe('Rating must be no more than 5');
    expect(validateField('Rating', 3.5, commonRules.rating)).toBe('Rating must be a whole number');
    expect(validateField('Rating', 4, commonRules.rating)).toBeNull();
  });
});