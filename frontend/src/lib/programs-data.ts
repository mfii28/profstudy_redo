import {
    collection,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { CourseProgram, ProgramCategory } from './db';

const DEFAULT_PROGRAMS: CourseProgram[] = [
    {
        id: 'icag',
        name: 'ICAG',
        categories: [
            { id: 'icag-fa', name: 'Financial Accounting' },
            { id: 'icag-ma', name: 'Management Accounting' },
            { id: 'icag-aa', name: 'Audit & Assurance' },
            { id: 'icag-tax', name: 'Taxation' },
            { id: 'icag-law', name: 'Law & Ethics' },
            { id: 'icag-psa', name: 'Public Sector Accounting' },
            { id: 'icag-sfm', name: 'Strategic Financial Management' },
        ],
    },
    {
        id: 'citg',
        name: 'CITG',
        categories: [
            { id: 'citg-income', name: 'Income Tax' },
            { id: 'citg-vat', name: 'VAT' },
            { id: 'citg-stamp', name: 'Stamp Duty' },
            { id: 'citg-evasion', name: 'Tax Evasion & Avoidance' },
            { id: 'citg-corporate', name: 'Corporate Tax' },
        ],
    },
    {
        id: 'corporate',
        name: 'Corporate Training',
        categories: [
            { id: 'corp-leadership', name: 'Leadership' },
            { id: 'corp-team', name: 'Team Management' },
            { id: 'corp-hr', name: 'HR Management' },
            { id: 'corp-ops', name: 'Operations' },
            { id: 'corp-project', name: 'Project Management' },
        ],
    },
    {
        id: 'digital-marketing',
        name: 'Digital Marketing',
        categories: [
            { id: 'dm-seo', name: 'SEO & SEM' },
            { id: 'dm-social', name: 'Social Media' },
            { id: 'dm-email', name: 'Email Marketing' },
            { id: 'dm-content', name: 'Content Marketing' },
            { id: 'dm-analytics', name: 'Analytics' },
        ],
    },
];

export const getPrograms = async (): Promise<CourseProgram[]> => {
    if (!db) return DEFAULT_PROGRAMS;
    try {
        const programsCollection = collection(db, 'programs');
        const snapshot = await getDocs(programsCollection);
        if (snapshot.empty) {
            await seedDefaultPrograms();
            return DEFAULT_PROGRAMS;
        }
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CourseProgram));
    } catch {
        return DEFAULT_PROGRAMS;
    }
};

const seedDefaultPrograms = async (): Promise<void> => {
    if (!db) return;
    try {
        const batch = writeBatch(db);
        DEFAULT_PROGRAMS.forEach(program => {
            const ref = doc(db, 'programs', program.id);
            batch.set(ref, program);
        });
        await batch.commit();
    } catch {
    }
};

export const saveProgram = async (program: CourseProgram): Promise<void> => {
    if (!db) return;
    const ref = doc(db, 'programs', program.id);
    await setDoc(ref, program, { merge: true });
};

export const savePrograms = async (programs: CourseProgram[]): Promise<void> => {
    if (!db) return;
    const batch = writeBatch(db);
    programs.forEach(program => {
        const ref = doc(db, 'programs', program.id);
        batch.set(ref, program, { merge: true });
    });
    await batch.commit();
};

export const addProgram = async (name: string): Promise<CourseProgram> => {
    const id = `prog-${Date.now()}`;
    const program: CourseProgram = { id, name, categories: [] };
    await saveProgram(program);
    return program;
};

export const updateProgram = async (
    program: CourseProgram,
    updates: Partial<Pick<CourseProgram, 'name'>>
): Promise<CourseProgram> => {
    const updated = { ...program, ...updates };
    await saveProgram(updated);
    return updated;
};

export const deleteProgram = async (programId: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, 'programs', programId));
};

export const addCategoryToProgram = async (
    program: CourseProgram,
    category: ProgramCategory
): Promise<CourseProgram> => {
    const updated: CourseProgram = {
        ...program,
        categories: [...program.categories, category],
    };
    await saveProgram(updated);
    return updated;
};

export const updateCategoryInProgram = async (
    program: CourseProgram,
    updated: ProgramCategory
): Promise<CourseProgram> => {
    const updatedProgram: CourseProgram = {
        ...program,
        categories: program.categories.map(c => c.id === updated.id ? updated : c),
    };
    await saveProgram(updatedProgram);
    return updatedProgram;
};

export const deleteCategoryFromProgram = async (
    program: CourseProgram,
    categoryId: string
): Promise<CourseProgram> => {
    const updatedProgram: CourseProgram = {
        ...program,
        categories: program.categories.filter(c => c.id !== categoryId),
    };
    await saveProgram(updatedProgram);
    return updatedProgram;
};
