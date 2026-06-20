'use client';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/firestore';

export type EmailTemplateKey = 'welcome' | 'purchaseReceipt' | 'courseApproval' | 'courseRejection';

export type EmailTemplate = {
  name: string;
  subject: string;
  body: string;
};

export type EmailTemplates = Record<EmailTemplateKey, EmailTemplate>;

const COLLECTION_ID = 'platformContent';
const DOC_ID = 'email-templates';

export const defaultEmailTemplates: EmailTemplates = {
  welcome: {
    name: 'Welcome Email',
    subject: 'Welcome to {{siteName}}, {{user.name}}!',
    body: `<h1>Welcome to the Community!</h1>
<p>Hi {{user.name}},</p>
<p>We are thrilled to have you join our community of professional learners! Our mission is to provide you with the AI-powered tools you need to master your exams.</p>
<p>To get started, we recommend:</p>
<ul>
  <li>Completing your student profile</li>
  <li>Exploring our latest course catalog</li>
  <li>Asking the AI Tutor your first question</li>
</ul>
<p>Happy learning,<br>The {{siteName}} Team</p>`,
  },
  purchaseReceipt: {
    name: 'Purchase Receipt',
    subject: 'Confirmation: Your {{siteName}} Order #{{order.id}}',
    body: `<h1>Thank You for Your Purchase!</h1>
<p>Hi {{user.name}},</p>
<p>Your order has been processed successfully. You now have full access to your new learning materials.</p>
<div style="border: 1px solid #eee; padding: 15px; margin: 20px 0; border-radius: 8px;">
  <p><strong>Order ID:</strong> #{{order.id}}</p>
  <p><strong>Total Paid:</strong> GH₵{{order.total}}</p>
  <p><strong>Item(s):</strong> {{course.title}}</p>
</div>
<p>You can access your course immediately from your student dashboard.</p>
<p>Success is waiting,<br>The {{siteName}} Team</p>`,
  },
  courseApproval: {
    name: 'Course Approved',
    subject: 'Your course "{{course.title}}" is now live!',
    body: `<h1>Your Course is Live! 🎉</h1>
<p>Hi {{user.name}},</p>
<p>Congratulations! Your course <strong>"{{course.title}}"</strong> has been reviewed and <strong>approved</strong> by our admin team.</p>
<p>It is now published and visible to students on the marketplace. Students can start enrolling immediately.</p>
<p>Track your enrollments and earnings from your Tutor Dashboard.</p>
<p>Keep creating great content,<br>The {{siteName}} Team</p>`,
  },
  courseRejection: {
    name: 'Course Needs Revision',
    subject: 'Action needed: "{{course.title}}" requires revision',
    body: `<h1>Course Review Update</h1>
<p>Hi {{user.name}},</p>
<p>Your course <strong>"{{course.title}}"</strong> was reviewed and requires changes before it can be published.</p>
<p>Common areas to check:</p>
<ul>
  <li>Course description completeness and accuracy</li>
  <li>Video quality and audio clarity</li>
  <li>Curriculum structure and lesson coverage</li>
  <li>Learning objectives alignment</li>
</ul>
<p>Please edit your course and resubmit it for review. If you have questions, contact our support team.</p>
<p>Best regards,<br>The {{siteName}} Team</p>`,
  },
};

export const getEmailTemplates = async (): Promise<EmailTemplates> => {
  if (!db) return defaultEmailTemplates;

  try {
    const ref = doc(db, COLLECTION_ID, DOC_ID);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, defaultEmailTemplates, { merge: true });
      return defaultEmailTemplates;
    }

    const data = snap.data() as Partial<EmailTemplates>;
    return {
      welcome: { ...defaultEmailTemplates.welcome, ...(data.welcome || {}) },
      purchaseReceipt: { ...defaultEmailTemplates.purchaseReceipt, ...(data.purchaseReceipt || {}) },
      courseApproval: { ...defaultEmailTemplates.courseApproval, ...(data.courseApproval || {}) },
      courseRejection: { ...defaultEmailTemplates.courseRejection, ...(data.courseRejection || {}) },
    };
  } catch {
    return defaultEmailTemplates;
  }
};

export const saveEmailTemplate = async (
  key: EmailTemplateKey,
  payload: Pick<EmailTemplate, 'subject' | 'body'>
): Promise<void> => {
  if (!db) return;

  const ref = doc(db, COLLECTION_ID, DOC_ID);
  await setDoc(
    ref,
    {
      [key]: payload,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
};
