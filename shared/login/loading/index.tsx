import * as React from 'react'
import * as Kb from '@/common-adapters'

type Props = {
  allowFeedback?: boolean
  failed: string
  status: string
  onRetry?: () => void
  onFeedback?: () => void
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

const Splash = (props: Props) => {
  const {allowFeedback = true} = props
  const [showFeedback, setShowFeedback] = React.useState(false)

  React.useEffect(() => {
    const id = setTimeout(() => {
      setShowFeedback(true)
    }, 7000)
    return () => clearTimeout(id)
  }, [])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container} gap="small">
      <Kb.Icon type={props.onRetry ? 'icon-keybase-logo-logged-out-80' : 'icon-keybase-logo-80'} />
      <Kb.Icon type="icon-keybase-wordmark-128-48" />
      {!!props.status && <Kb.Text type="BodySmall">{props.status}</Kb.Text>}
      {!!props.failed && (
        <Kb.Text type="BodySmall">
          Oops, we had a problem communicating with our services. This might be because you lost connectivity.
        </Kb.Text>
      )}
      {!!props.failed && <Kb.Text type="BodySmall">({props.failed})</Kb.Text>}
      {props.onRetry && (
        <Kb.ButtonBar>
          <Kb.Button label="Reload" onClick={props.onRetry} />
        </Kb.ButtonBar>
      )}
      {(props.onRetry || showFeedback) && allowFeedback && <Feedback onFeedback={props.onFeedback} />}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {alignItems: 'center', justifyContent: 'center'},
    }) as const
)

export default React.memo(Splash)
