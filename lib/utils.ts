export const isAllZeros = (token: string): boolean => {
  if (!token) return true;
  
  // Remove spaces and check if all characters are zeros
  return /^0+$/.test(token.replace(/\s/g, ''));
};

export const isValidToken = (token?: string): boolean => {
  if (!token || token.trim() === '') return false;
//   if (isAllZeros(token)) return false;
  // Remove spaces
  const cleanToken = token.replace(/\s+/g, '');
  // Check if it has exactly 20 digits and contains only numbers
  const isTwentyDigits = /^\d{20}$/.test(cleanToken);
  return isTwentyDigits;
};