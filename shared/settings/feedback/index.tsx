import React from 'react'
import {globalMargins} from '../../styles'
import * as Kb from '../../common-adapters'
import {isMobile} from '../../util/container'
import * as Styles from '../../styles/index'

export const getOtherErrorInfo = (err: Error) => {
  const info = {}
  for (const k in err) info[k] = (err as Object)[k]
  // @ts-ignore
  delete info.name
  // @ts-ignore
  delete info.message
  // @ts-ignore
  delete info.stack
  return info
}

type Props = {
  loggedOut: boolean
  onSendFeedback: (feedback: string, sendLogs: boolean) => void
  sending: boolean
  sendError: Error | null
}

type State = {
  email: string | null
  showSuccessBanner: boolean
  sendLogs: boolean
  feedback: string
}

class Feedback extends React.Component<Props, State> {
  state = {
    email: null,
    feedback: '',
    sendLogs: true,
    showSuccessBanner: false,
  }
  componentDidUpdate(prevProps: Props) {
    if (prevProps.sending !== this.props.sending || this.props.sendError !== prevProps.sendError) {
      this.setState({
        showSuccessBanner: !this.props.sending && !this.props.sendError,
      })
    }
  }
  _onChangeFeedback = feedback => {
    this.setState({feedback})
  }
  _onChangeSendLogs = (sendLogs: boolean) => this.setState({sendLogs})

  _onChangeEmail = email => {
    this.setState({email})
  }

  _onSendFeedback = () => {
    this.setState({showSuccessBanner: false})
    this.props.onSendFeedback(
      this.state.email ? `${this.state.feedback} (email: ${this.state.email} )` : this.state.feedback,
      this.state.sendLogs
    )
  }
  render() {
    const {sending, sendError} = this.props
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center">
        <Kb.ScrollView>
          {this.state.showSuccessBanner && <Kb.Banner color="green" text="Thanks! Your feedback was sent." />}
          <Kb.Box2 direction="vertical" style={styles.mainBox} gap="xsmall">
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              <Kb.Input
                autoCapitalize="sentences"
                autoCorrect={true}
                autoFocus={true}
                style={{flex: 1}}
                hideLabel={true}
                inputStyle={{textAlign: 'left'}}
                multiline={true}
                rowsMin={4}
                rowsMax={isMobile ? 4 : 10}
                hintText="Please tell us what you were doing, your experience, or anything else we should know. Thanks!"
                value={this.state.feedback}
                onChangeText={this._onChangeFeedback}
              />
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
              <Kb.Checkbox label="" checked={this.state.sendLogs} onCheck={this._onChangeSendLogs} />
              <Kb.Box2 direction="vertical" style={styles.textBox}>
                <Kb.Text type="Body">Include your logs</Kb.Text>
                <Kb.Text type="BodySmall">
                  This includes some private metadata info (e.g., filenames, but not contents) but it will
                  help the developers fix bugs more quickly.
                </Kb.Text>
              </Kb.Box2>
            </Kb.Box2>
            {this.props.loggedOut && (
              <Kb.Box2 direction="horizontal" fullWidth={true}>
                <Kb.NewInput placeholder="Email (pretty please!)" onChangeText={this._onChangeEmail} />
              </Kb.Box2>
            )}
            <Kb.ButtonBar>
              <Kb.Button fullWidth={true} label="Send" onClick={this._onSendFeedback} waiting={sending} />
            </Kb.ButtonBar>
            {sendError && (
              <Kb.Box2 direction="vertical" gap="small">
                <Kb.Text type="BodySmallError">Could not send log</Kb.Text>
                <Kb.Text type="BodySmall" selectable={true}>
                  {`${sendError.name}: ${sendError.message}`}
                </Kb.Text>
                <Kb.Text type="BodySmallSemibold">Stack</Kb.Text>
                <Kb.Text type="BodySmall" selectable={true}>
                  {sendError.stack}
                </Kb.Text>
                <Kb.Text type="BodySmallSemibold">Error dump</Kb.Text>
                <Kb.Text type="BodySmall" selectable={true}>
                  {JSON.stringify(getOtherErrorInfo(sendError), null, 2)}
                </Kb.Text>
              </Kb.Box2>
            )}
          </Kb.Box2>
        </Kb.ScrollView>
      </Kb.Box2>
    )
  }
}

export default Feedback

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      flex: 1,
    },
  }),
  mainBox: {
    padding: globalMargins.small,
  },
  outerStyle: {
    backgroundColor: 'white',
  },
  smallLabel: {
    color: 'black',
  },
  textBox: {
    flex: 1,
  },
})
