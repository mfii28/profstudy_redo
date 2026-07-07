export const validatePhoneNumber = (phone: string) => {
  return phone.length > 5;
};

export async function validateAffiliateLink(...args: any[]) { return { valid: false }; }
export async function validateStudentRegistrationNumber(...args: any[]) { return { valid: false }; }
