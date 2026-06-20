'use client';

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { PersonalizedStudyPlanOutput } from './db';

/**
 * @fileOverview Persistence layer for AI-generated study roadmaps.
 */

const COLLECTION_NAME = 'study_plans';

export const saveStudyPlan = async (userId: string, plan: PersonalizedStudyPlanOutput): Promise<void> => {
    if (!db) return;
    // We use the userId as the document ID because a student usually only has one active plan
    const planRef = doc(db, COLLECTION_NAME, userId);
    await setDoc(planRef, {
        ...plan,
        updatedAt: new Date().toISOString()
    }, { merge: true });
};

export const getActiveStudyPlan = async (userId: string): Promise<PersonalizedStudyPlanOutput | null> => {
    if (!db || !userId) return null;
    const planRef = doc(db, COLLECTION_NAME, userId);
    const snap = await getDoc(planRef);
    return snap.exists() ? snap.data() as PersonalizedStudyPlanOutput : null;
};

export const toggleTaskCompletion = async (userId: string, taskId: string, isCompleted: boolean): Promise<void> => {
    if (!db || !userId) return;
    const planRef = doc(db, COLLECTION_NAME, userId);
    const snap = await getDoc(planRef);
    
    if (snap.exists()) {
        const plan = snap.data() as PersonalizedStudyPlanOutput;
        const updatedStudyPlan = plan.studyPlan.map(day => ({
            ...day,
            tasks: day.tasks.map(task => 
                task.id === taskId ? { ...task, isCompleted } : task
            )
        }));

        await updateDoc(planRef, { studyPlan: updatedStudyPlan });
    }
};
