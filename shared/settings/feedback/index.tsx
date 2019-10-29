import React from 'react'
import * as Kb from '../../common-adapters'
import {isMobile} from '../../util/container'
import * as Styles from '../../styles'

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
  feedback?: string | null
  loggedOut: boolean
  onSendFeedback: (feedback: string, sendLogs: boolean, sendMaxBytes: boolean) => void
  sending: boolean
  sendError: Error | null
  showInternalSuccessBanner: boolean // if true, enables the internal success bar
  onFeedbackDone: (success: boolean) => void
}

type State = {
  clickCount: number
  email: string | null
  feedback: string
  sendLogs: boolean
  showSuccessBanner: boolean
}

const clickThreshold = 7

class Feedback extends React.Component<Props, State> {
  state = {
    clickCount: 0,
    email: null,
    feedback: this.props.feedback || '',
    sendLogs: true,
    showSuccessBanner: false,
  }

  _onLabelClick = () => {
    this.setState(state => {
      const clickCount = state.clickCount + 1
      if (clickCount < clickThreshold) {
        console.log(`clickCount = ${clickCount} (${clickThreshold - clickCount} away from sending full logs)`)
      }
      return {clickCount}
    })
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.sending !== this.props.sending || this.props.sendError !== prevProps.sendError) {
      const success = !this.props.sending && !this.props.sendError
      this.setState(s => ({
        feedback: success ? '' : s.feedback,
        showSuccessBanner: this.props.showInternalSuccessBanner && success,
      }))
      this.props.onFeedbackDone(success)
    }
  }

  _onChangeFeedback = feedback => {
    this.setState({feedback})
  }

  _onChangeSendLogs = (sendLogs: boolean) => this.setState({sendLogs})

  _onChangeEmail = email => {
    this.setState({email})
  }

  _sendMaxBytes = () => this.state.clickCount >= clickThreshold

  _onSendFeedback = () => {
    const sendMaxBytes = this._sendMaxBytes()
    this.setState({clickCount: 0, showSuccessBanner: false})
    this.props.onSendFeedback(
      this.state.email ? `${this.state.feedback} (email: ${this.state.email || ''} )` : this.state.feedback,
      this.state.sendLogs,
      sendMaxBytes
    )
  }

  render() {
    const {sending, sendError} = this.props
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center">
        <Kb.ScrollView alwaysBounceVertical={false}>
          {this.state.showSuccessBanner && (
            <Kb.Banner color="green">
              <Kb.BannerParagraph bannerColor="green" content="Thanks! Your feedback was sent." />
            </Kb.Banner>
          )}
          <Kb.Box2 direction="vertical" style={styles.mainBox} gap="xsmall">
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              <Kb.NewInput
                autoCapitalize="sentences"
                autoCorrect={true}
                autoFocus={true}
                containerStyle={styles.input}
                multiline={true}
                onChangeText={this._onChangeFeedback}
                placeholder="Please tell us what you were doing, your experience, or anything else we should know. Thanks!"
                rowsMin={4}
                rowsMax={isMobile ? 4 : 10}
                value={this.state.feedback}
              />
            </Kb.Box2>
            {this._sendMaxBytes() && (
              <Kb.Banner color="green">
                <Kb.BannerParagraph bannerColor="green" content="next send will include full logs" />
              </Kb.Banner>
            )}
            <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
              <Kb.Checkbox
                label="Include your logs"
                labelSubtitle="This includes some private metadata info (e.g., file sizes, but not names or contents) but it will help the developers fix bugs more quickly."
                checked={this.state.sendLogs}
                onCheck={this._onChangeSendLogs}
              />
            </Kb.Box2>
            {this.props.loggedOut && (
              <Kb.Box2 direction="horizontal" fullWidth={true}>
                <Kb.NewInput
                  containerStyle={styles.input}
                  placeholder="Your email address"
                  onChangeText={this._onChangeEmail}
                />
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        common: {flex: 1},
      }),
      input: Styles.platformStyles({
        isElectron: {padding: Styles.globalMargins.tiny},
        isMobile: {...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small)},
      }),
      mainBox: Styles.platformStyles({
        common: {padding: Styles.globalMargins.small},
        isElectron: {width: 368},
      }),
      outerStyle: {backgroundColor: Styles.globalColors.white},
      smallLabel: {color: Styles.globalColors.black},
    } as const)
)
