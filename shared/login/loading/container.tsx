import * as C from '../../constants'
import * as Constants from '../../constants/config'
import * as Container from '../../util/container'
import Splash from '.'

const SplashContainer = () => {
  const failedReason = Constants.useDaemonState(s => s.handshakeFailedReason)
  const retriesLeft = Constants.useDaemonState(s => s.handshakeRetriesLeft)
  const startHandshake = Constants.useDaemonState(s => s.dispatch.startHandshake)

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onFeedback = () => {
    navigateAppend({props: {}, selected: 'feedback'})
  }

  const onRetry = () => {
    startHandshake()
  }

  let status = ''
  let failed = ''

  // Totally failed
  if (retriesLeft === 0) {
    failed = failedReason
  } else if (retriesLeft === Constants.maxHandshakeTries) {
    // First try
    status = 'Loading...'
  } else {
    const failedText = failedReason ? `: ${failedReason}` : ''
    status = `Loading...  (still trying${failedText})`
  }

  return (
    <Splash
      failed={failed}
      onFeedback={Container.isMobile ? onFeedback : undefined}
      onRetry={retriesLeft === 0 ? onRetry : undefined}
      status={status}
    />
  )
}

export default SplashContainer
