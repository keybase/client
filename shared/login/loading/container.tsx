import * as C from '@/constants'
import Splash from '.'

const SplashContainer = () => {
  const failedReason = C.useDaemonState(s => s.handshakeFailedReason)
  const retriesLeft = C.useDaemonState(s => s.handshakeRetriesLeft)
  const startHandshake = C.useDaemonState(s => s.dispatch.startHandshake)

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onFeedback = () => {
    navigateAppend('feedback')
  }

  const onRetry = () => {
    startHandshake()
  }

  let status = ''
  let failed = ''

  // Totally failed
  if (retriesLeft === 0) {
    failed = failedReason
  } else if (retriesLeft === C.maxHandshakeTries) {
    // First try
    status = 'Loading...'
  } else {
    const failedText = failedReason ? `: ${failedReason}` : ''
    status = `Loading...  (still trying${failedText})`
  }

  return (
    <Splash
      failed={failed}
      onFeedback={C.isMobile ? onFeedback : undefined}
      onRetry={retriesLeft === 0 ? onRetry : undefined}
      status={status}
    />
  )
}

export default SplashContainer
