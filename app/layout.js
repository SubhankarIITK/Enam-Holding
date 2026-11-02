import './globals.css';
import WorkspaceGate from '@/components/WorkspaceGate';
import ThemeProvider from '@/components/ThemeProvider';
import {themeBootstrap} from '@/lib/theme';
import localFont from 'next/font/local';
const inter = localFont({src:'./fonts/InterVariable.woff2',variable:'--font-inter',weight:'100 900',display:'swap'});
export const metadata = {
  title: 'FINN — Your investment attention, focused.',
  description: 'A mobile-first investment workspace. Portfolio signals, source-grounded research, and less noise.',
  applicationName: 'FINN'
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0B1220' };
export default function RootLayout({ children }) {
  return <html lang="en" className={inter.variable} data-theme="dark" suppressHydrationWarning><head><script id="finn-theme" dangerouslySetInnerHTML={{__html:themeBootstrap}}/></head><body><ThemeProvider><WorkspaceGate>{children}</WorkspaceGate></ThemeProvider></body></html>;
}
