import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  allowFeedback?: boolean
  failed: string
  status: string
  onRetry: (() => void) | null
  onFeedback: (() => void) | null
}

const Feedback = ({onFeedback}) =>
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
  const setShowFeedbackTrueLater = Kb.useTimeout(() => setShowFeedback(true), 7000)
  React.useEffect(() => {
    if (!__STORYBOOK__) {
      setShowFeedbackTrueLater()
    }
  }, [setShowFeedbackTrueLater])
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container} gap="small">
      <Kb.Icon
        type={props.onRetry ? Kb.IconType.icon_keybase_logo_logged_out_80 : Kb.IconType.icon_keybase_logo_80}
      />
      <Kb.Icon type={Kb.IconType.icon_keybase_wordmark_128_48} />
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {alignItems: 'center', justifyContent: 'center'},
    } as const)
)

export default Splash
