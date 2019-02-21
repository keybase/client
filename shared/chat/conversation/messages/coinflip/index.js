// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import CoinFlipParticipants from './participants'

export type Props = {|
  progressText: string,
  resultText: string,
  isError: boolean,
  participants: Array<RPCChatTypes.UICoinFlipParticipant>,
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
  render() {
    const popup = (
      <CoinFlipParticipants
        attachTo={this._getAttachmentRef}
        onHidden={this._hidePopup}
        participants={this.props.participants}
        visible={this.state.showPopup}
      />
    )
    return (
      <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} gap="tiny">
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="BodySmall">Progress</Kb.Text>
          <Kb.Text
            type="BodyItalic"
            style={Styles.collapseStyles([styles.progress, this.props.isError ? styles.error : null])}
          >
            {this.props.progressText}
          </Kb.Text>
        </Kb.Box2>
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
