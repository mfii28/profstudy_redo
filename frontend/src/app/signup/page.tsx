'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { registerUser, checkRegistrationNumberExistsAction } from '@/app/actions/user';
import { signIn } from 'next-auth/react';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { validatePassword, validateFullName } from '@/lib/password-validation';
import {
  validatePhoneNumber,
  validateStudentRegistrationNumber,
  validateAffiliateLink,
} from '@/lib/signup-validation';

function sanitizeReferralId(rawReferralId: string | null): string | null {
  const normalizedReferralId = rawReferralId?.trim();

  if (
    !normalizedReferralId ||
    normalizedReferralId.toLowerCase() === 'undefined' ||
    normalizedReferralId.toLowerCase() === 'null'
  ) {
    return null;
  }

  return normalizedReferralId;
}

const REFERRAL_CODE_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

function buildReferralLinkFromCode(code: string): string {
  const normalizedBaseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://profstrainingsolutions.com');

  return `${normalizedBaseUrl}/ref/${encodeURIComponent(code)}`;
}

function extractReferralCodeFromAffiliateLink(rawLink: string): string | null {
  const validation = validateAffiliateLink(rawLink);
  if (!validation.isValid || !validation.sanitized) {
    return null;
  }

  try {
    const parsed = new URL(validation.sanitized);
    const segments = parsed.pathname.split('/').filter(Boolean);

    let candidate = '';
    if (parsed.hostname.startsWith('ref.')) {
      candidate = segments[0] || '';
    } else {
      const refSegmentIndex = segments.findIndex((segment) => segment.toLowerCase() === 'ref');
      if (refSegmentIndex >= 0) {
        candidate = segments[refSegmentIndex + 1] || '';
      }
    }

    return REFERRAL_CODE_REGEX.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

// Input Field Component with Label, Help Text, and Validation Status
interface FormFieldProps {
  id: string;
  label: string;
  type?: string;
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  helpText?: string;
  maxLength?: number;
}

function FormField({
  id,
  label,
  type = 'text',
  inputMode = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  required = false,
  disabled = false,
  helpText,
  maxLength,
}: FormFieldProps) {
  const isValid = !error && value.length > 0;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="flex items-center gap-2">
        {label}
        {required && <span className="text-red-500">*</span>}
        {isValid && <CheckCircle2 className="h-4 w-4 text-green-500" />}
      </Label>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error || helpText ? `${id}-description` : undefined}
      />
      {(error || helpText) && (
        <div
          id={`${id}-description`}
          className={`text-sm ${error ? 'text-red-500 flex items-center gap-1' : 'text-muted-foreground'}`}
          role={error ? 'alert' : undefined}
        >
          {error && <AlertCircle className="h-3 w-3" />}
          {error || helpText}
        </div>
      )}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('tutor') === '1') {
      sessionStorage.setItem('signup_intent', 'tutor');
    }
  }, []);
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [registrationError, setRegistrationError] = useState('');
  const [affiliateError, setAffiliateError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || affiliateLink) return;

    const storedLink = localStorage.getItem('studymate_ref_link')?.trim() || '';
    if (storedLink) {
      const linkValidation = validateAffiliateLink(storedLink);
      if (linkValidation.isValid && linkValidation.sanitized) {
        setAffiliateLink(linkValidation.sanitized);
        return;
      }
    }

    const storedRefCode = sanitizeReferralId(localStorage.getItem('studymate_ref'));
    if (storedRefCode && REFERRAL_CODE_REGEX.test(storedRefCode)) {
      setAffiliateLink(buildReferralLinkFromCode(storedRefCode));
    }
  }, [affiliateLink]);

  const handlePhoneBlur = () => {
    const validation = validatePhoneNumber(phoneNumber);
    if (phoneNumber && !validation.isValid) {
      setPhoneError(validation.error || 'Invalid phone number');
    } else if (validation.normalized && validation.normalized !== phoneNumber) {
      setPhoneNumber(validation.normalized);
      setPhoneError('');
    } else {
      setPhoneError('');
    }
  };

  const handleRegistrationBlur = async () => {
    const trimmed = registrationNumber.trim();
    if (!trimmed) {
      setRegistrationError('');
      return;
    }
    const validation = validateStudentRegistrationNumber(trimmed);
    if (!validation.isValid) {
      setRegistrationError(validation.error || 'Invalid registration number');
    } else {
      // Check uniqueness using server action
      const exists = await checkRegistrationNumberExistsAction(trimmed);
      if (exists) {
        setRegistrationError('This registration number is already registered');
      } else {
        setRegistrationError('');
      }
    }
  };

  const handleAffiliateBlur = () => {
    if (affiliateLink) {
      const validation = validateAffiliateLink(affiliateLink);
      setAffiliateError(validation.isValid ? '' : (validation.error || 'Invalid URL'));
    } else {
      setAffiliateError('');
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const nameCheck = validateFullName(fullName);
    if (!nameCheck.isValid) {
        toast({ variant: 'destructive', title: 'Invalid Input', description: nameCheck.error });
        return;
    }
    const passCheck = validatePassword(password);
    if (!passCheck.isValid) {
        toast({ variant: 'destructive', title: 'Weak Password', description: passCheck.error });
        return;
    }

    // Validate fields
    const phoneCheck = validatePhoneNumber(phoneNumber);
    if (!phoneCheck.isValid) {
      setPhoneError(phoneCheck.error || 'Invalid phone number');
      toast({ variant: 'destructive', title: 'Invalid Phone', description: phoneCheck.error });
      return;
    }

    const regTrim = registrationNumber.trim();
    let regNormalized: string | undefined;
    if (regTrim) {
      const regCheck = validateStudentRegistrationNumber(regTrim);
      if (!regCheck.isValid) {
        setRegistrationError(regCheck.error || 'Invalid registration number');
        toast({ variant: 'destructive', title: 'Invalid Registration', description: regCheck.error });
        return;
      }
      regNormalized = regCheck.normalized;
    }

    const affCheck = validateAffiliateLink(affiliateLink);
    if (affiliateLink && !affCheck.isValid) {
      setAffiliateError(affCheck.error || 'Invalid affiliate link');
      toast({ variant: 'destructive', title: 'Invalid Link', description: affCheck.error });
      return;
    }

    setIsLoading(true);

    try {
      const storedRefCode = sanitizeReferralId(
        typeof window !== 'undefined' ? localStorage.getItem('studymate_ref') : null
      );
      const linkRefCode = extractReferralCodeFromAffiliateLink(affiliateLink);
      const referralCode = storedRefCode || linkRefCode;
      
      const isTutorSignup =
        (typeof window !== 'undefined' && sessionStorage.getItem('signup_intent') === 'tutor') ||
        (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tutor') === '1');

      const signupRes = await registerUser({
        name: fullName,
        email,
        password,
        role: isTutorSignup ? 'tutor' : 'student',
        phone_number: phoneCheck.normalized || phoneNumber,
        student_registration_number: regNormalized,
        affiliate_link: affiliateLink && affCheck.isValid ? (affCheck.sanitized || affiliateLink) : undefined,
        referredBy: referralCode || undefined,
      });

      if (signupRes.error) {
        toast({ variant: 'destructive', title: 'Signup Failed', description: signupRes.error });
        setIsLoading(false);
        return;
      }

      // Automatically sign in via NextAuth credentials provider
      const signinRes = await signIn('credentials', {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (signinRes?.error) {
        toast({
          variant: 'destructive',
          title: 'Sign In Failed',
          description: 'Account created, but could not sign in automatically. Please log in.',
        });
        setIsLoading(false);
        router.push('/login');
        return;
      }

      if (typeof window !== 'undefined') {
        localStorage.removeItem('studymate_ref');
        localStorage.removeItem('studymate_ref_link');
        sessionStorage.removeItem('signup_intent');
      }

      // Set session cookie for local compatibility layers
      const secure = window.location.protocol === 'https:' ? 'Secure;' : '';
      const mockSessionToken = Buffer.from(JSON.stringify({ uid: signupRes.user.id, role: signupRes.user.role })).toString('base64');
      document.cookie = `__session=${mockSessionToken}; path=/; max-age=3600; SameSite=Lax; ${secure}`;

      if (signupRes.otpError) {
        toast({
          title: 'Account Created',
          description: 'Verification email could not be sent. You can request a new code from the next screen.',
        });
      } else {
        toast({
          title: 'Account Created',
          description: 'A 6-digit verification code has been sent to your inbox.',
        });
      }

      router.replace(`/verify-email?uid=${signupRes.user.id}`);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Signup Failed', description: error.message || 'An unexpected error occurred.' });
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Google Signup Failed', description: error.message });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[42%] bg-primary flex-col justify-between p-12 relative overflow-hidden flex-shrink-0">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-72 h-72 bg-accent/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent/10 rounded-full translate-x-1/2 translate-y-1/2" />
        </div>
        <Link href="/">
          <Logo textClassName="text-primary-foreground" />
        </Link>
        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <span className="h-px w-8 bg-accent" aria-hidden />
            <span className="section-label !mb-0">Get started free</span>
          </div>
          <h2 className="font-headline font-black text-[clamp(2rem,3.5vw,3rem)] text-primary-foreground leading-tight">
            Join Ghana's<br />top ICAG &amp;<br />CITG platform.
          </h2>
          <div className="mt-8 space-y-3">
            {['AI-powered study plans', 'Expert-led courses', 'Flexible online scheduling', 'Verified certifications'].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-accent" />
                </span>
                <span className="text-sm text-primary-foreground/70">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-primary-foreground/30 relative">
          © {new Date().getFullYear()} Profs Training Solutions
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12 overflow-y-auto">
        {/* Mobile logo */}
        <Link href="/" className="mb-8 lg:hidden">
          <Logo />
        </Link>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="font-headline font-black text-2xl text-primary tracking-tight">Create account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ghana's elite ICAG &amp; CITG preparation platform.</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full Name</Label>
              <Input id="full-name" placeholder="Ama Boateng" required value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={isLoading} className="h-11" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email Address</Label>
              <Input id="email" type="email" placeholder="name@company.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} className="h-11" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} minLength={6} className="h-11 pr-10" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="phone-number"
                label="Phone Number"
                type="tel"
                inputMode="tel"
                placeholder="+233 20 123 4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                onBlur={handlePhoneBlur}
                error={phoneError}
                required={true}
                disabled={isLoading}
                helpText="E.164 or Ghana local (02x-xxxxxxx)"
                maxLength={20}
              />
              <FormField
                id="registration-number"
                label="Registration Number"
                type="text"
                placeholder="STUD-2024-123456"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                onBlur={handleRegistrationBlur}
                error={registrationError}
                required={false}
                disabled={isLoading}
                helpText="Optional. Your student or institution ID (any format)."
                maxLength={512}
              />
            </div>

            <FormField
              id="affiliate-link"
              label="Affiliate Link (Optional)"
              type="url"
              inputMode="url"
              placeholder="https://profstrainingsolutions.com/ref/your-name"
              value={affiliateLink}
              onChange={(e) => setAffiliateLink(e.target.value)}
              onBlur={handleAffiliateBlur}
              error={affiliateError}
              required={false}
              disabled={isLoading}
              helpText="Enter a valid referral link from profstrainingsolutions.com"
              maxLength={512}
            />

            <Button type="submit" className="w-full h-11 font-bold" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Account'}
            </Button>

            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-11 font-semibold gap-2"
              onClick={handleGoogleSignup}
              type="button"
              disabled={isLoading}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign up with Google
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/signup?tutor=1" className="text-primary font-bold hover:underline">
              Sign up as a tutor
            </Link>
            <span className="mx-2 text-border">·</span>
            Already a member?{' '}
            <Link href="/login" className="text-primary font-bold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
