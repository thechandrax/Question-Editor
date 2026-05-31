import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Link Slayer — Slay Every Shortlink',
  description: 'Break the chain of redirects, slash through ad-networks, and slay every countdown lock — the true link is yours.',
};

export default function ShortlinkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
