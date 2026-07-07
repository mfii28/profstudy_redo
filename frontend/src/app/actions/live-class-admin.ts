'use server';
export const backfillLiveClasses = async (...args: any[]) => ({ success: true, error: undefined, created: 0, skipped: 0 });
export const saveNewCourseWithLiveClass = async (...args: any[]) => ({ success: true });
export const ensureLiveClassForCourse = async (...args: any[]) => ({ success: true });

export async function getLiveClassesAction(...args: any[]) { return { classes: [] }; }
export async function getLiveClassesForStudentAction(...args: any[]) { return { classes: [] }; }
export async function getLiveClassesByTutorIdAction(...args: any[]) { return { classes: [] }; }
export async function addLiveClassAction(...args: any[]) { return { error: 'Not implemented' }; }
export async function deleteLiveClassAction(...args: any[]) { return { error: 'Not implemented' }; }
