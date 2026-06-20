'use client';

import { Linkedin, Instagram, Twitter, Youtube } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '../logo';
import { Button } from '../ui/button';
import { useEffect, useState } from 'react';
import { getGlobalSettings, defaultGlobalSettings } from '@/lib/platform-settings-data';
import { type GlobalSettings } from '@/lib/db';

const socialLinks = [
  { icon: <Linkedin />, key: 'socialLinkedin' as const },
  { icon: <Instagram />, key: 'socialInstagram' as const },
  { icon: <Twitter />, key: 'socialTwitter' as const },
  { icon: <Youtube />, key: 'socialYoutube' as const },
];

const footerLinks = {
  Platform: [
    { label: 'Courses', href: '/courses' },
    { label: 'Shop', href: '/shop' },
    { label: 'About Us', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
  Resources: [
    { label: 'Help Center', href: '/contact' },
    { label: 'Testimonials', href: '/testimonials' },
    { label: 'Gallery', href: '/gallery' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
    { label: 'Refund Policy', href: '/refund-policy' },
  ],
  Company: [
    { label: 'Become an Instructor', href: '/teach'},
    { label: 'Terms of Service', href: '/terms-of-service' },
  ],
};

export function Footer() {
  const [settings, setSettings] = useState<GlobalSettings>(defaultGlobalSettings);

  useEffect(() => {
    getGlobalSettings().then(setSettings);
  }, []);

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="page-container py-12 md:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4">
            <Logo textClassName="text-primary-foreground" />
            <p className="text-primary-foreground/80">
              {settings.siteDescription}
            </p>
            <address className="not-italic text-primary-foreground/80 text-sm leading-relaxed">
                {settings.businessAddress.split(',').map((line, i) => (
                  <span key={i}>{line.trim()}<br/></span>
                ))}
                {settings.supportPhone}
            </address>
            <div className="flex gap-2">
              {socialLinks.map((link, index) => {
                const href = settings[link.key];
                if (!href) return null;
                return (
                  <Button key={index} variant="ghost" size="icon" className="text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground" asChild>
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {link.icon}
                    </a>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 lg:col-span-3">
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h3 className="font-headline font-semibold text-accent">{title}</h3>
                <ul className="mt-4 space-y-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-primary-foreground/80 hover:text-accent"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-primary-foreground/20 pt-8 text-center text-sm text-primary-foreground/60">
          <p>&copy; {new Date().getFullYear()} {settings.siteName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
