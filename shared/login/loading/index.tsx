import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = Kb.PropsWithTimer<{
  failed: string
  status: string
  onRetry: (() => void) | null
  onFeedback: (() => void) | null
}>

type State = {
  showFeedback: boolean
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

class Splash extends React.Component<Props, State> {
  state = {
    showFeedback: false,
  }

  componentDidMount() {
    if (!__STORYBOOK__) {
      this.props.setTimeout(() => {
        this.setState({showFeedback: true})
      }, 7000)
    }
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container} gap="small">
        <Kb.Icon type={this.props.onRetry ? 'icon-keybase-logo-logged-out-80' : 'icon-keybase-logo-80'} />
        <Kb.Icon type="icon-keybase-wordmark-128-48" />
        {!!this.props.status && <Kb.Text type="BodySmall">{this.props.status}</Kb.Text>}
        {!!this.props.failed && (
          <Kb.Text type="BodySmall">
            Oops, we had a problem communicating with our services. This might be because you lost
            connectivity.
          </Kb.Text>
        )}
        {!!this.props.failed && <Kb.Text type="BodySmall">({this.props.failed})</Kb.Text>}
        {this.props.onRetry && (
          <Kb.ButtonBar>
            <Kb.Button label="Reload" onClick={this.props.onRetry} />
          </Kb.ButtonBar>
        )}
        {(this.props.onRetry || this.state.showFeedback) && <Feedback onFeedback={this.props.onFeedback} />}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {alignItems: 'center', justifyContent: 'center'},
})

export default Kb.HOCTimers(Splash)
