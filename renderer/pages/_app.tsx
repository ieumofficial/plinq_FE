import type { AppProps } from 'next/app'
import { Inter, Work_Sans } from 'next/font/google'

import '../styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-work-sans',
  display: 'swap',
})

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className={`${inter.variable} ${workSans.variable}`}>
      <Component {...pageProps} />
    </div>
  )
}

export default MyApp
