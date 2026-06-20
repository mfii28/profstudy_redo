/**
 * @fileOverview Shared email HTML template builders.
 * Can be imported from both server actions (email.ts) and client components.
 */

const DEFAULT_BASE_URL = 'https://mytestingdomain.icu';

function getBaseUrl(): string {
  // On server: process.env is available. On client: NEXT_PUBLIC_ vars only.
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  return DEFAULT_BASE_URL;
}

export function emailShell(siteName: string, userEmail: string, accentColor: string, body: string): string {
  const baseUrl = getBaseUrl();
  const year = new Date().getFullYear();
  const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(userEmail)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:#111827;padding:28px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-.5px;">${siteName}</span>
              </td>
              <td align="right">
                <span style="display:inline-block;background:${accentColor};border-radius:20px;padding:4px 12px;color:#fff;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;">
                  Official Notice
                </span>
              </td>
            </tr></table>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:40px;">${body}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">
              &copy; ${year} ${siteName}. You are receiving this as a registered member.
            </p>
            <a href="${unsubscribeUrl}" style="font-size:11px;color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function ctaButton(label: string, href: string, color = '#111827'): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background:${color};border-radius:8px;">
      <a href="${href}" style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:.01em;">${label}</a>
    </td></tr>
  </table>`;
}

export function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;">`;
}

export function buildWelcomeEmailHtml(siteName: string, userName: string, userEmail: string): string {
  const baseUrl = getBaseUrl();
  const body = `
    <h2 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">Welcome, ${userName}!</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">You've joined a community of professional learners.</p>
    ${divider()}
    <p style="font-size:15px;color:#374151;line-height:1.7;">
      We're thrilled to have you at <strong>${siteName}</strong>. Your account is ready — 
      explore courses, use AI-powered study tools, and track your progress toward your professional goals.
    </p>
    <p style="font-size:14px;color:#6b7280;line-height:1.6;">Here's what to do first:</p>
    <ul style="font-size:14px;color:#374151;line-height:2;padding-left:20px;margin:0 0 20px;">
      <li>Complete your student profile</li>
      <li>Browse the course catalog</li>
      <li>Ask the AI Tutor your first question</li>
    </ul>
    ${ctaButton('Go to My Dashboard', `${baseUrl}/student-dashboard`, '#111827')}
    ${divider()}
    <p style="font-size:13px;color:#6b7280;margin:0;">
      Happy learning,<br><strong style="color:#374151;">The ${siteName} Team</strong>
    </p>`;
  return emailShell(siteName, userEmail, '#10b981', body);
}

export function buildEnrollmentConfirmationHtml(
  siteName: string,
  userName: string,
  userEmail: string,
  items: string,
  orderId: string,
  amount: number
): string {
  const baseUrl = getBaseUrl();
  const body = `
    <h2 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">Order Confirmed!</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Hi ${userName}, your payment was successful.</p>
    ${divider()}
    <table width="100%" cellpadding="12" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin:0 0 20px;">
      <tr>
        <td style="font-size:13px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">ORDER ID</td>
        <td align="right" style="font-size:13px;color:#111827;font-weight:700;border-bottom:1px solid #e5e7eb;">#${orderId}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">ITEMS</td>
        <td align="right" style="font-size:13px;color:#111827;font-weight:700;border-bottom:1px solid #e5e7eb;">${items}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6b7280;font-weight:600;">TOTAL PAID</td>
        <td align="right" style="font-size:15px;color:#111827;font-weight:800;">GH&#8373;${amount.toFixed(2)}</td>
      </tr>
    </table>
    <p style="font-size:14px;color:#374151;line-height:1.6;">
      Your learning materials are ready immediately. Head to <strong>My Learning</strong> in your dashboard to get started.
    </p>
    ${ctaButton('Go to My Learning', `${baseUrl}/student-dashboard/my-learning`, '#10b981')}
    ${divider()}
    <p style="font-size:13px;color:#6b7280;margin:0;">
      Need help? Reply to this email or contact our support team.<br>
      <strong style="color:#374151;">The ${siteName} Team</strong>
    </p>`;
  return emailShell(siteName, userEmail, '#10b981', body);
}

export function buildCourseApprovalEmailHtml(
  siteName: string,
  tutorName: string,
  tutorEmail: string,
  courseTitle: string,
  courseId: string
): string {
  const baseUrl = getBaseUrl();
  const body = `
    <h2 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">Your Course is Live!</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Hi ${tutorName}, great news from the review team.</p>
    ${divider()}
    <p style="font-size:15px;color:#374151;line-height:1.7;">
      Your course <strong>"${courseTitle}"</strong> has been reviewed and <span style="color:#10b981;font-weight:700;">approved</span>. 
      It is now published and visible to students on the marketplace.
    </p>
    <table width="100%" cellpadding="12" cellspacing="0" style="background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin:20px 0;">
      <tr>
        <td style="font-size:13px;color:#166534;font-weight:600;">STATUS</td>
        <td align="right" style="font-size:13px;color:#166534;font-weight:800;">&#10003; Published &amp; Live</td>
      </tr>
    </table>
    <p style="font-size:14px;color:#374151;line-height:1.6;">
      Students can now enroll and you will start earning from their purchases. 
      You can track enrollments and revenue in your Tutor Dashboard.
    </p>
    ${ctaButton('View My Course', `${baseUrl}/tutor-dashboard/courses/${courseId}`, '#10b981')}
    ${divider()}
    <p style="font-size:13px;color:#6b7280;margin:0;">
      Keep creating great content!<br><strong style="color:#374151;">The ${siteName} Team</strong>
    </p>`;
  return emailShell(siteName, tutorEmail, '#10b981', body);
}

export function buildCourseRejectionEmailHtml(
  siteName: string,
  tutorName: string,
  tutorEmail: string,
  courseTitle: string,
  courseId: string
): string {
  const baseUrl = getBaseUrl();
  const body = `
    <h2 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">Course Review Update</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Hi ${tutorName}, we have an update regarding your submission.</p>
    ${divider()}
    <p style="font-size:15px;color:#374151;line-height:1.7;">
      Your course <strong>"${courseTitle}"</strong> was reviewed and requires changes before it can be published. 
      Our team found areas that need improvement to meet our quality standards.
    </p>
    <table width="100%" cellpadding="12" cellspacing="0" style="background:#fef2f2;border-radius:8px;border:1px solid #fecaca;margin:20px 0;">
      <tr>
        <td style="font-size:13px;color:#991b1b;font-weight:600;">STATUS</td>
        <td align="right" style="font-size:13px;color:#991b1b;font-weight:800;">Needs Revision</td>
      </tr>
    </table>
    <p style="font-size:14px;color:#374151;line-height:1.6;">
      Please edit your course content and resubmit it for review. Common areas to check:
    </p>
    <ul style="font-size:14px;color:#374151;line-height:2;padding-left:20px;margin:0 0 20px;">
      <li>Course description completeness and accuracy</li>
      <li>Video quality and audio clarity</li>
      <li>Curriculum structure and lesson coverage</li>
      <li>Learning objectives alignment</li>
    </ul>
    ${ctaButton('Edit My Course', `${baseUrl}/tutor-dashboard/courses/${courseId}/edit`, '#ef4444')}
    ${divider()}
    <p style="font-size:13px;color:#6b7280;margin:0;">
      Questions? Contact our support team and reference your course ID: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">${courseId}</code><br>
      <strong style="color:#374151;">The ${siteName} Team</strong>
    </p>`;
  return emailShell(siteName, tutorEmail, '#ef4444', body);
}

export function buildAnnouncementEmailHtml(
  siteName: string,
  recipientName: string,
  userEmail: string,
  subject: string,
  message: string,
  type: 'Info' | 'Warning' | 'Promotion'
): string {
  const accentColors: Record<string, string> = { Info: '#3b82f6', Warning: '#f59e0b', Promotion: '#10b981' };
  const typeLabels: Record<string, string> = { Info: 'Platform Update', Warning: 'Important Notice', Promotion: 'Special Offer' };
  const accent = accentColors[type] ?? '#3b82f6';
  const body = `
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${accent};">
      ${typeLabels[type] ?? 'Update'}
    </p>
    <h2 style="margin:0 0 20px;font-size:24px;font-weight:800;color:#111827;">${subject}</h2>
    ${divider()}
    <p style="font-size:14px;color:#6b7280;margin:0 0 12px;">Hi ${recipientName},</p>
    <div style="font-size:15px;color:#374151;line-height:1.75;white-space:pre-line;">${message}</div>
    ${divider()}
    <p style="font-size:13px;color:#6b7280;margin:0;">
      Warm regards,<br><strong style="color:#374151;">The ${siteName} Team</strong>
    </p>`;
  return emailShell(siteName, userEmail, accent, body);
}

export function buildOtpEmailHtml(
  siteName: string,
  userName: string,
  code: string,
  expiryMinutes: number
): string {
  const digits = code.split('');
  const digitBoxes = digits.map(d =>
    `<span style="display:inline-block;width:44px;height:52px;line-height:52px;text-align:center;font-size:28px;font-weight:800;color:#111827;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;margin:0 4px;letter-spacing:0;">${d}</span>`
  ).join('');

  const body = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;">Verify your email</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Hi ${userName}, enter this code to confirm your email address.</p>
    <div style="text-align:center;margin:24px 0 8px;">
      ${digitBoxes}
    </div>
    <p style="text-align:center;font-size:13px;color:#9ca3af;margin:8px 0 24px;">This code expires in <strong>${expiryMinutes} minutes</strong>.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="font-size:13px;color:#6b7280;margin:0;">
      If you did not create a ${siteName} account, you can safely ignore this email.
    </p>`;

  return emailShell(siteName, '', '#2563eb', body);
}

// ─── Live session / Zoom notification ─────────────────────────────────────────

export function buildLiveSessionEmailHtml(
  siteName: string,
  studentName: string,
  studentEmail: string,
  courseTitle: string,
  sessionTitle: string,
  instructor: string,
  startTime: string,   // ISO string
  durationMinutes: number,
): string {
  const baseUrl = getBaseUrl();

  // Format date/time in a locale-friendly way without importing heavy libraries.
  let formattedDate = startTime;
  let formattedTime = '';
  try {
    const d = new Date(startTime);
    formattedDate = d.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    formattedTime = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  } catch { /* leave as ISO if parsing fails */ }

  const body = `
    <h2 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">New Live Class Scheduled!</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Hi ${studentName}, your instructor has scheduled a new live session.</p>
    ${divider()}
    <table width="100%" cellpadding="12" cellspacing="0" style="background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin:0 0 20px;">
      <tr>
        <td style="font-size:13px;color:#166534;font-weight:600;border-bottom:1px solid #d1fae5;">SESSION</td>
        <td align="right" style="font-size:13px;color:#111827;font-weight:700;border-bottom:1px solid #d1fae5;">${sessionTitle}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#166534;font-weight:600;border-bottom:1px solid #d1fae5;">COURSE</td>
        <td align="right" style="font-size:13px;color:#111827;font-weight:700;border-bottom:1px solid #d1fae5;">${courseTitle}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#166534;font-weight:600;border-bottom:1px solid #d1fae5;">INSTRUCTOR</td>
        <td align="right" style="font-size:13px;color:#111827;font-weight:700;border-bottom:1px solid #d1fae5;">${instructor}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#166534;font-weight:600;border-bottom:1px solid #d1fae5;">DATE</td>
        <td align="right" style="font-size:13px;color:#111827;font-weight:700;border-bottom:1px solid #d1fae5;">${formattedDate}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#166534;font-weight:600;border-bottom:1px solid #d1fae5;">TIME</td>
        <td align="right" style="font-size:13px;color:#111827;font-weight:700;border-bottom:1px solid #d1fae5;">${formattedTime}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#166534;font-weight:600;">DURATION</td>
        <td align="right" style="font-size:13px;color:#111827;font-weight:700;">${durationMinutes} minutes</td>
      </tr>
    </table>
    <p style="font-size:14px;color:#374151;line-height:1.6;">
      When the session starts, head to your classroom to join. The join link will be available in your 
      <strong>Classroom</strong> and <strong>Live Classes</strong> sections.
    </p>
    ${ctaButton('Go to My Classroom', `${baseUrl}/student-dashboard/live-classes`, '#10b981')}
    ${divider()}
    <p style="font-size:13px;color:#6b7280;margin:0;">
      See you in class!<br><strong style="color:#374151;">The ${siteName} Team</strong>
    </p>`;
  return emailShell(siteName, studentEmail, '#10b981', body);
}

// ─── Admin manual enrollment ───────────────────────────────────────────────────

export function buildAdminEnrollmentEmailHtml(
  siteName: string,
  studentName: string,
  studentEmail: string,
  courseTitle: string,
  courseId: string,
): string {
  const baseUrl = getBaseUrl();
  const body = `
    <h2 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">You've Been Enrolled!</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Hi ${studentName}, an administrator has enrolled you in a course.</p>
    ${divider()}
    <table width="100%" cellpadding="12" cellspacing="0" style="background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin:0 0 20px;">
      <tr>
        <td style="font-size:13px;color:#166534;font-weight:600;">COURSE</td>
        <td align="right" style="font-size:13px;color:#111827;font-weight:800;">${courseTitle}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#166534;font-weight:600;">STATUS</td>
        <td align="right" style="font-size:13px;color:#166534;font-weight:800;">&#10003; Enrolled</td>
      </tr>
    </table>
    <p style="font-size:14px;color:#374151;line-height:1.6;">
      Your course access is active immediately. Head to <strong>My Learning</strong> to start your first lesson.
    </p>
    ${ctaButton('Start Learning', `${baseUrl}/student-dashboard/learn/${courseId}`, '#10b981')}
    ${divider()}
    <p style="font-size:13px;color:#6b7280;margin:0;">
      Happy learning!<br><strong style="color:#374151;">The ${siteName} Team</strong>
    </p>`;
  return emailShell(siteName, studentEmail, '#10b981', body);
}

// ─── Free course enrollment confirmation ──────────────────────────────────────

export function buildFreeEnrollmentEmailHtml(
  siteName: string,
  studentName: string,
  studentEmail: string,
  courseTitle: string,
  courseId: string,
): string {
  const baseUrl = getBaseUrl();
  const body = `
    <h2 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">Enrollment Confirmed!</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Hi ${studentName}, you're now enrolled in a free course.</p>
    ${divider()}
    <table width="100%" cellpadding="12" cellspacing="0" style="background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin:0 0 20px;">
      <tr>
        <td style="font-size:13px;color:#166534;font-weight:600;">COURSE</td>
        <td align="right" style="font-size:13px;color:#111827;font-weight:800;">${courseTitle}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#166534;font-weight:600;">PRICE</td>
        <td align="right" style="font-size:13px;color:#166534;font-weight:800;">FREE</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#166534;font-weight:600;">ACCESS</td>
        <td align="right" style="font-size:13px;color:#166534;font-weight:800;">&#10003; Immediate &amp; Unlimited</td>
      </tr>
    </table>
    <p style="font-size:14px;color:#374151;line-height:1.6;">
      Your course is ready to start right now. All lessons are unlocked — learn at your own pace.
    </p>
    ${ctaButton('Start Learning', `${baseUrl}/student-dashboard/learn/${courseId}`, '#10b981')}
    ${divider()}
    <p style="font-size:13px;color:#6b7280;margin:0;">
      Enjoy your free course!<br><strong style="color:#374151;">The ${siteName} Team</strong>
    </p>`;
  return emailShell(siteName, studentEmail, '#10b981', body);
}

// ─── Email verification success ───────────────────────────────────────────────

export function buildEmailVerifiedSuccessHtml(
  siteName: string,
  userName: string,
  userEmail: string,
): string {
  const baseUrl = getBaseUrl();
  const body = `
    <h2 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">Email Verified Successfully</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280;">Hi ${userName}, your account verification is complete.</p>
    ${divider()}
    <p style="font-size:15px;color:#374151;line-height:1.7;">
      You're now fully verified on <strong>${siteName}</strong> and can access all student features.
    </p>
    <ul style="font-size:14px;color:#374151;line-height:2;padding-left:20px;margin:0 0 20px;">
      <li>Access your classroom and course materials</li>
      <li>Track learning progress from your dashboard</li>
      <li>Use AI study tools without verification prompts</li>
    </ul>
    ${ctaButton('Open Dashboard', `${baseUrl}/student-dashboard`, '#10b981')}
    ${divider()}
    <p style="font-size:13px;color:#6b7280;margin:0;">
      Thanks for verifying your account.<br><strong style="color:#374151;">The ${siteName} Team</strong>
    </p>`;
  return emailShell(siteName, userEmail, '#10b981', body);
}
