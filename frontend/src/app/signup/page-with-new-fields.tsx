import { redirect } from 'next/navigation';

/** Legacy duplicate signup route — canonical form lives at /signup. */
export default function SignupWithNewFieldsRedirect() {
  redirect('/signup');
}
