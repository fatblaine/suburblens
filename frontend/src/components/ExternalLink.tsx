import type { AnchorHTMLAttributes } from 'react'
import { Browser } from '@capacitor/browser'
import { isNativeApp } from '../lib/platform'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

// Drop-in for <a target="_blank">. In the app an off-site link would hand the
// user over to Safari and out of SuburbLens; the in-app browser sheet keeps
// them one "Done" tap from where they were. On the web it is a plain anchor.
export default function ExternalLink({ href, onClick, ...rest }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
      onClick={(e) => {
        onClick?.(e)
        if (!isNativeApp) return
        e.preventDefault()
        Browser.open({ url: href })
      }}
    />
  )
}
