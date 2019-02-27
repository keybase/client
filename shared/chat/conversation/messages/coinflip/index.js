// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import CoinFlipParticipants from './participants'
import CoinFlipError from './errors'

export type Props = {|
  commitmentVis: string,
  revealVis: string,
  resultText: string,
  errorInfo?: ?RPCChatTypes.UICoinFlipError,
  participants: Array<RPCChatTypes.UICoinFlipParticipant>,
  progressText: string,
  showParticipants: boolean,
|}

type State = {
  showPopup: boolean,
}

class CoinFlip extends React.Component<Props, State> {
  _partRef = React.createRef()
  state = {showPopup: false}
  _showPopup = () => {
    this.setState({showPopup: true})
  }
  _hidePopup = () => {
    this.setState({showPopup: false})
  }
  _getAttachmentRef = () => {
    return this._partRef.current
  }
  _revealSummary = () => {
    const total = this.props.participants.length
    const revealed = this.props.participants.reduce((r, p) => {
      return r + (p.reveal ? 1 : 0)
    }, 0)
    return `${revealed} / ${total}`
  }
  render() {
    const popup = (
      <CoinFlipParticipants
        attachTo={this._getAttachmentRef}
        onHidden={this._hidePopup}
        participants={this.props.participants}
        visible={this.state.showPopup}
      />
    )
    const commitSrc = `data:image/png;base64, ${this.props.commitmentVis}`
    const revealSrc = `data:image/png;base64, ${this.props.revealVis}`
    return (
      <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} gap="tiny">
        {this.props.errorInfo ? (
          <CoinFlipError error={this.props.errorInfo} />
        ) : (
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
            <Kb.Box2 direction="vertical">
              <Kb.Text type="BodySmall">Commitments: {this.props.participants.length}</Kb.Text>
              {this.props.commitmentVis.length > 0 ? (
                <Kb.Image src={commitSrc} style={styles.progressVis} />
              ) : (
                <Kb.Box2 direction="vertical" style={styles.progressVis}>
                  <Kb.Text type="BodyItalic">Starting flip...</Kb.Text>
                </Kb.Box2>
              )}
            </Kb.Box2>
            <Kb.Box2 direction="vertical">
              <Kb.Text type="BodySmall">Secrets: {this._revealSummary()}</Kb.Text>
              {this.props.revealVis.length > 0 ? (
                <Kb.Image src={revealSrc} style={styles.progressVis} />
              ) : (
                <Kb.Box2 direction="vertical" style={styles.progressVis} />
              )}
            </Kb.Box2>
          </Kb.Box2>
        )}
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
            <Kb.Text type="BodySmall">Result</Kb.Text>
            {this.props.showParticipants && (
              <Kb.Box2 direction="horizontal" onMouseOver={this._showPopup} onMouseLeave={this._hidePopup}>
                <Kb.Text
                  ref={this._partRef}
                  type="BodySmallPrimaryLink"
                  style={styles.participantsLabel}
                  onClick={this._showPopup}
                >
                  View Participants
                </Kb.Text>
                {popup}
              </Kb.Box2>
            )}
          </Kb.Box2>
          <Kb.Markdown style={styles.result} allowFontScaling={true}>
            {this.props.resultText.length > 0 ? this.props.resultText : '???'}
          </Kb.Markdown>
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    alignSelf: 'flex-start',
    borderColor: Styles.globalColors.lightGrey,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    marginTop: Styles.globalMargins.xtiny,
    padding: Styles.globalMargins.tiny,
  },
  error: {
    color: Styles.globalColors.red,
  },
  participantsLabel: Styles.platformStyles({
    isElectron: {
      lineHeight: 16,
    },
  }),
  progress: Styles.platformStyles({
    isElectron: {
      cursor: 'text',
      userSelect: 'text',
      wordBreak: 'break-all',
    },
  }),
  progressVis: Styles.platformStyles({
    isElectron: {
      height: 50,
      width: 128,
    },
    isMobile: {
      height: 50,
      width: 112,
    },
  }),
  result: Styles.platformStyles({
    common: {
      fontWeight: '600',
    },
    isElectron: {
      cursor: 'text',
      userSelect: 'text',
      wordBreak: 'break-all',
    },
  }),
})

export default CoinFlip
