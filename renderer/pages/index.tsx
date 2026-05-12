import { useEffect, type CSSProperties } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import DarkBackground from '../components/DarkBackground'
import Logo from '../components/ui/Logo'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabase'

const noDrag: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // window.ipc only exists when running inside the Electron renderer
    // (exposed via preload.ts). In a regular browser preview or before
    // preload finishes, it's undefined — skip the subscription rather
    // than crashing the page.
    if (typeof window === 'undefined' || !window.ipc) return
    const cleanup = window.ipc.on(
      'auth-callback',
      (tokens: { access_token: string; refresh_token: string }) => {
        supabase.auth
          .setSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
          })
          .then(({ error }) => {
            if (!error) {
              router.push('/choose-org')
            }
          })
      }
    )
    return cleanup
  }, [router])

  const handleGetStarted = () => {
    // 프로덕션: 시스템 브라우저 (plinq:// 프로토콜 등록됨)
    // 개발: 앱 내 창 (프로토콜 미등록 우회)
    if (typeof window === 'undefined' || !window.ipc) return
    const isProd = process.env.NODE_ENV === 'production'
    window.ipc.send(
      isProd ? 'open-external' : 'open-login-window',
      'https://plinq.kr/login'
    )
  }

  return (
    <>
      <Head>
        <title>plinq</title>
      </Head>
      <DarkBackground>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-10 py-16">
          <Logo variant="on-dark" size={48} />

          <p className="text-gray-main text-[14px]">
            Your AI co-pilot for every project.
          </p>

          <div className="w-full max-w-[309px]" style={noDrag}>
            <Button
              variant="secondary"
              onClick={handleGetStarted}
              className="w-full"
            >
              Get Started
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-6 px-6">
          <p className="text-gray-main text-[10px]">
            &copy; 2026 plinq. All rights reserved.
          </p>
        </div>
      </DarkBackground>
    </>
  )
}
