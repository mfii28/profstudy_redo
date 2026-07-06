'use server';

export const adminMarkEmailVerified = async (args: any): Promise<{ success: boolean; error?: string }> => {
    return { success: true };
};
