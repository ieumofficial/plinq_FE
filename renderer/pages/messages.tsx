import Head from 'next/head'
import PersonalAppShell from '../components/PersonalAppShell'
import Icon from '../components/ui/Icon'

export default function MessagesPage() {
  return (
    <>
      <Head>
        <title>plinq · Messages</title>
      </Head>
      <PersonalAppShell active="messages">
        <div className="p-6 flex items-center justify-center min-h-full">
          <div className="text-center max-w-[400px]">
            <span className="inline-flex w-12 h-12 rounded-full bg-gray-extra-light text-gray-secondary items-center justify-center mb-4">
              <Icon name="Chat" size={20} />
            </span>
            <h2 className="text-black text-[18px] font-semibold mb-2">Messages</h2>
            <p className="text-gray-secondary text-[12px]">
              The Messages experience is still being designed. It will live here once
              we&apos;ve nailed down the conversation model.
            </p>
          </div>
        </div>
      </PersonalAppShell>
    </>
  )
}
