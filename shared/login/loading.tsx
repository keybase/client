import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useDaemonState} from '@/stores/daemon'

const SplashContainer = () => {
  const failedReason = useDaemonState(s => s.handshakeFailedReason)
  const retriesLeft = useDaemonState(s => s.handshakeRetriesLeft)
  const startHandshake = useDaemonState(s => s.dispatch.startHandshake)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

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

  const onFeedback = C.isMobile
    ? () => {
        navigateAppend('feedback')
      }
    : undefined
  const onRetry = retriesLeft === 0 ? startHandshake : undefined

  return <Splash failed={failed} status={status} onRetry={onRetry} onFeedback={onFeedback} />
}

type SplashProps = {
  allowFeedback?: boolean
  failed: string
  status: string
  onRetry?: () => void
  onFeedback?: () => void
}
export const Splash = (p: SplashProps) => {
  const {allowFeedback = true, failed, status, onRetry, onFeedback} = p
  const [showFeedback, setShowFeedback] = React.useState(false)

  React.useEffect(() => {
    const id = setTimeout(() => {
      setShowFeedback(true)
    }, 7000)
    return () => clearTimeout(id)
  }, [])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container} gap="small">
      <Kb.Icon type={onRetry ? 'icon-keybase-logo-logged-out-80' : 'icon-keybase-logo-80'} />
      <Kb.Icon type="icon-keybase-wordmark-128-48" />
      {!!status && <Kb.Text type="BodySmall">{status}</Kb.Text>}
      {!!failed && (
        <Kb.Text type="BodySmall">
          Oops, we had a problem communicating with our services. This might be because you lost connectivity.
        </Kb.Text>
      )}
      {!!failed && <Kb.Text type="BodySmall">({failed})</Kb.Text>}
      {onRetry && (
        <Kb.ButtonBar>
          <Kb.Button label="Reload" onClick={onRetry} />
        </Kb.ButtonBar>
      )}
      {(onRetry || showFeedback) && allowFeedback && <Feedback onFeedback={onFeedback} />}
    </Kb.Box2>
  )
}

const Feedback = ({onFeedback}: {onFeedback?: () => void}) =>
  onFeedback ? (
    <Kb.ButtonBar>
      <Kb.Button type="Dim" label="Send us feedback" onClick={onFeedback} />
    </Kb.ButtonBar>
  ) : (
    <Kb.Text type="BodySmall">
      Send us feedback! Run{' '}
      <Kb.Text type="TerminalInline" selectable={true}>
        keybase log send
      </Kb.Text>{' '}
      from the terminal.
    </Kb.Text>
  )

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {alignItems: 'center', justifyContent: 'center'},
    }) as const
)

export default SplashContainer
