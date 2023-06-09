import * as Constants from '../../constants/config'
import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import Splash from '.'

const SplashContainer = () => {
  const dispatch = Container.useDispatch()
  const failedReason = Constants.useConfigState(s => s.daemonHandshakeFailedReason)
  const retriesLeft = Container.useSelector(s => s.config.daemonHandshakeRetriesLeft)

  const onFeedback = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {}, selected: 'feedback'}]}))
  }

  const onRetry = () => {
    dispatch(ConfigGen.createStartHandshake())
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
