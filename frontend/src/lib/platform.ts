import { Capacitor } from '@capacitor/core'

// True inside the iOS app shell, false in any browser. Everything that must
// behave differently in the app (ads, analytics, external links, auth
// redirects) keys off this one flag so the web build stays untouched.
export const isNativeApp = Capacitor.isNativePlatform()

// Auth emails and shared links must point at the real site: inside the app
// window.location.origin is capacitor://localhost, which no mail client or
// other phone can open.
export const PUBLIC_ORIGIN = isNativeApp ? 'https://www.suburblensapp.com' : window.location.origin
