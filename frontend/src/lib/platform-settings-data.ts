import { getGlobalSettingsAction, setGlobalSettingsAction } from '@/app/actions/settings';
import { type GlobalSettings } from './db';

/**
 * @fileOverview Isomorphic Platform Governance Service.
 * ARCHITECTURE: Implements strict defaults and safe SSR checks.
 */

let settingsCache: GlobalSettings | null = null;

export const defaultGlobalSettings: GlobalSettings = {
  siteName: 'Profs Training Solutions',
  siteDescription: 'Your AI-powered companion for professional ICAG & CITG mastery.',
  contactEmail: '',
  supportEmail: '',
  supportPhone: '',
  businessAddress: '',
  logoUrl: '',
  defaultLanguage: 'English',
  defaultCurrency: 'GHS',
  timezone: 'UTC+0 (GMT)',
  dateFormat: 'DD/MM/YYYY',
  smtpServer: 'smtp.gmail.com',
  smtpPortTls: '587',
  smtpPortSsl: '465',
  smtpUser: '',
  smtpPass: '',
  defaultCoursePrice: '150',
  minCoursePrice: '50',
  maxCoursePrice: '5000',
  maxDiscountPct: '50',
  taxEnabled: true,
  taxPct: '17.5',
  invoicePrefix: 'PTS-',
  payoutThreshold: '100',
  payoutFrequency: 'monthly',
  platformCommission: '20',
  defaultStudentTokens: '50',
  defaultTutorTokens: '500',
  enableAutoCourseReview: false,
  enableAutoCategorization: true,
  aiModelTier: 'flash',
  maintenanceMode: false,
  blockExternalLinksInChat: true,
  enableAutoFlagging: true,
  loginAttemptLimit: '5',
  requireTutorVerification: true,
  requireStudentId: false,
  studentToTutorMessaging: true,
  allowReviewAutoApproval: false,
  affiliateCommissionPct: '10',
  affiliateApprovalRequired: true,
  tutorAnalyticsAccess: true,
  contentOwnership: 'The platform retains non-exclusive rights to distribute academic content.',
  gdprEnabled: true,
  dataRetentionDays: '365',
  allowPublicRegistration: true,
  notifNewUserAlert: true,
  notifNewCourseAlert: true,
  notifNewOrderAlert: true,
  notifPayoutRequest: true,
  notifSecurityAlert: true,
  maxUploadMb: '100',
  allowedImageTypes: 'jpg,jpeg,png,webp,gif',
  allowedVideoTypes: 'mp4,mov,avi,mkv,webm',
  allowedDocTypes: 'pdf,doc,docx,ppt,pptx,xls,xlsx',
  socialFacebook: '',
  socialInstagram: '',
  socialTwitter: '',
  socialLinkedin: '',
  socialYoutube: '',
  commSmsEnabled: false,
  commWhatsappEnabled: false,
  commEmailEnabled: true,
  commInAppEnabled: true,
  commOtpSmsEnabled: true,
  commOtpWhatsappEnabled: false,
  commRetryLimit: '3',
  commRateLimitPerMinute: '60',
};

export const getGlobalSettings = async (forceRefresh = false): Promise<GlobalSettings> => {
    if (settingsCache && !forceRefresh) {
        return settingsCache;
    }
    const settings = await getGlobalSettingsAction(forceRefresh);
    settingsCache = settings;
    return settings;
};

export const setGlobalSettings = async (settings: GlobalSettings): Promise<void> => {
    await setGlobalSettingsAction(settings);
    settingsCache = settings;
};