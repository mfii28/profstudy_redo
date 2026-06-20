import { NextResponse } from 'next/server';

/**
 * Onboarding has been removed from the platform.
 *
 * This endpoint remains as a compatibility shim for older cached clients/chunks
 * that still call /api/onboarding. It always returns a completed state so the
 * UI can continue without blocking the user.
 */

const COMPLETED_STATE = {
  userId: 'deprecated',
  currentStep: 'complete',
  completedSteps: ['profile', 'interests', 'goals', 'preferences', 'complete'],
  profileData: {},
  interestsData: {
    selectedCategories: [],
  },
  goalsData: {},
  preferencesData: {},
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
};

export async function GET() {
  return NextResponse.json({
    disabled: true,
    message: 'Onboarding has been removed.',
    state: COMPLETED_STATE,
  });
}

export async function POST() {
  return NextResponse.json({
    disabled: true,
    message: 'Onboarding has been removed. No changes were saved.',
    state: {
      ...COMPLETED_STATE,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function PUT() {
  return NextResponse.json({
    disabled: true,
    message: 'Onboarding has been removed. No changes were saved.',
    state: {
      ...COMPLETED_STATE,
      updatedAt: new Date().toISOString(),
    },
  });
}
