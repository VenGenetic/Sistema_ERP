/**
 * Phone number utilities for Ecuador (+593).
 * Cleans, normalizes, and formats phone numbers for WhatsApp integration.
 */

const ECUADOR_COUNTRY_CODE = '593';

/**
 * Cleans a phone number string by removing all non-digit characters.
 */
function stripNonDigits(phone: string): string {
    return phone.replace(/\D/g, '');
}

/**
 * Normalizes an Ecuadorian phone number to international format (no + prefix, just digits).
 * 
 * Handles:
 * - "+593 99 123 4567" → "593991234567"
 * - "0991234567" → "593991234567"
 * - "991234567" → "593991234567"
 * - "593991234567" → "593991234567"
 * 
 * @param phone Raw phone string from the database
 * @returns Normalized phone number string (digits only, with country code)
 */
export function normalizePhoneEC(phone: string | null | undefined): string {
    if (!phone) return '';
    
    let digits = stripNonDigits(phone);
    
    if (!digits) return '';

    // Already has Ecuador country code
    if (digits.startsWith(ECUADOR_COUNTRY_CODE)) {
        return digits;
    }
    
    // Starts with leading zero (local format: 0991234567)
    if (digits.startsWith('0')) {
        digits = digits.substring(1);
    }
    
    // Prepend Ecuador country code
    return `${ECUADOR_COUNTRY_CODE}${digits}`;
}

/**
 * Formats a phone number for display purposes.
 * E.g., "593991234567" → "+593 99 123 4567"
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
    const normalized = normalizePhoneEC(phone);
    if (!normalized || normalized.length < 10) return phone || '';
    
    // Format: +593 XX XXX XXXX
    const countryCode = normalized.substring(0, 3);
    const area = normalized.substring(3, 5);
    const part1 = normalized.substring(5, 8);
    const part2 = normalized.substring(8);
    
    return `+${countryCode} ${area} ${part1} ${part2}`;
}

/**
 * Checks if a phone string looks like a valid Ecuadorian mobile number.
 * Ecuadorian mobiles: 09XXXXXXXX (10 digits local) → 593 9X XXX XXXX
 */
export function isValidECMobile(phone: string | null | undefined): boolean {
    const normalized = normalizePhoneEC(phone);
    // Ecuador mobile: 593 + 9 digit number starting with 9
    return normalized.length === 12 && normalized.startsWith('5939');
}
