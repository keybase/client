import * as Constants from '../../constants/config'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import Splash from '.'

const SplashContainer = () => {
  const dispatch = Container.useDispatch()
  const failedReason = Constants.useDaemonState(s => s.handshakeFailedReason)
  const retriesLeft = Constants.useDaemonState(s => s.handshakeRetriesLeft)
  const startHandshake = Constants.useDaemonState(s => s.dispatch.startHandshake)

  const onFeedback = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {}, selected: 'feedback'}]}))
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
