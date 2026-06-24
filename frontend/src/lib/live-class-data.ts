'use client';

import {
  getLiveClassesAction,
  getLiveClassesForStudentAction,
  getLiveClassesByTutorIdAction,
  addLiveClassAction,
  deleteLiveClassAction,
} from '@/app/actions/live-class-admin';
import type { LiveClass } from '@/lib/db';

export const getLiveClasses = async (db?: any): Promise<LiveClass[]> => {
  return getLiveClassesAction();
};

export const getLiveClassesForStudent = async (db: any, enrolledCourseIds: string[]): Promise<LiveClass[]> => {
  return getLiveClassesForStudentAction(enrolledCourseIds);
};

export const getLiveClassesByTutorId = async (db: any, tutorId: string): Promise<LiveClass[]> => {
  return getLiveClassesByTutorIdAction(tutorId);
};

export const addLiveClass = (db: any, newClass: LiveClass): Promise<void> => {
  return addLiveClassAction(newClass);
};

export const deleteLiveClass = (db: any, classId: string): Promise<void> => {
  return deleteLiveClassAction(classId);
};

