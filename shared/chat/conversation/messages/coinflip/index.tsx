import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {pluralize} from '../../../../util/string'
import CoinFlipParticipants from './participants'
import CoinFlipError from './errors'
import CoinFlipResult from './results'

export type Props = {
  commitmentVis: string
  isSendError: boolean
  onFlipAgain: () => void
  revealVis: string
  resultText: string
  errorInfo?: RPCChatTypes.UICoinFlipError | null
  participants: Array<RPCChatTypes.UICoinFlipParticipant>
  phase: 'commitments' | 'secrets' | 'complete' | 'loading' | null
  progressText: string
  resultInfo?: RPCChatTypes.UICoinFlipResult | null
  showParticipants: boolean
}

type State = {
  showPopup: boolean
}

class CoinFlip extends React.Component<Props, State> {
  _partRef = React.createRef<Kb.Box2>()
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
  _renderStatusText = () =>
    this.props.showParticipants ? (
      <Kb.Box2
        direction="vertical"
        onMouseOver={this._showPopup}
        onMouseLeave={this._hidePopup}
        ref={this._partRef}
      >
        {!Styles.isMobile && (
          <Kb.Text selectable={true} type="BodySmall">
            Secured by{' '}
          </Kb.Text>
        )}
        <Kb.Text selectable={true} type="BodySmallPrimaryLink" onClick={this._showPopup}>
          {`${this.props.participants.length} ${pluralize('participant', this.props.participants.length)}`}
        </Kb.Text>
        <CoinFlipParticipants
          attachTo={this._getAttachmentRef}
          onHidden={this._hidePopup}
          participants={this.props.participants}
          visible={this.state.showPopup}
        />
      </Kb.Box2>
    ) : (
      <Kb.Box2 direction="vertical">
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
          <Kb.Text selectable={true} type="BodySmallSemibold">
            {!Styles.isMobile && 'Collecting '}commitments: {this.props.participants.length}
          </Kb.Text>
          {this.props.phase === 'secrets' && (
            <Kb.Icon type="iconfont-check" color={Styles.globalColors.green} sizeType="Small" />
          )}
        </Kb.Box2>
        {this.props.phase === 'secrets' && (
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
            <Kb.Text selectable={true} type="BodySmallSemibold">
              {!Styles.isMobile && 'Collecting '}secrets: {this._revealSummary()}
            </Kb.Text>
          </Kb.Box2>
        )}
      </Kb.Box2>
    )
  render() {
    const commitSrc = `data:image/png;base64, ${this.props.commitmentVis}`
    const revealSrc = `data:image/png;base64, ${this.props.revealVis}`
    return (
      <Kb.Box2
        direction="vertical"
        style={Styles.collapseStyles([!this.props.errorInfo && styles.container])}
        fullWidth={true}
      >
        {this.props.errorInfo ? (
          <CoinFlipError error={this.props.errorInfo} />
        ) : (
          <>
            <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
              <Kb.Box2 direction="vertical">
                {this.props.commitmentVis.length > 0 ? (
                  <Kb.Image src={commitSrc} style={styles.progressVis} />
                ) : (
                  <Kb.Box2
                    direction="vertical"
                    style={Styles.collapseStyles([styles.placeholder, styles.progressVis])}
                  />
                )}
              </Kb.Box2>
              <Kb.Box2 direction="vertical">
                {this.props.revealVis.length > 0 && this.props.phase !== 'commitments' ? (
                  <Kb.Image src={revealSrc} style={styles.progressVis} />
                ) : (
                  <Kb.Box2
                    direction="vertical"
                    style={Styles.collapseStyles([styles.placeholder, styles.progressVis])}
                  />
                )}
              </Kb.Box2>
              <Kb.Box2 direction="vertical">{this._renderStatusText()}</Kb.Box2>
            </Kb.Box2>
          </>
        )}
        <Kb.Box2 direction="vertical" fullWidth={true}>
          {this.props.resultInfo && <CoinFlipResult result={this.props.resultInfo} />}
        </Kb.Box2>
        {this.props.isSendError || !!this.props.errorInfo ? (
          <Kb.Box2 direction="vertical" alignSelf="flex-start" style={styles.flipAgainContainer}>
            <Kb.Text type="BodySmallSecondaryLink" onClick={this.props.onFlipAgain} style={styles.error}>
              Try again
            </Kb.Text>
          </Kb.Box2>
        ) : (
          this.props.phase === 'complete' && (
            <Kb.Box2 direction="vertical" alignSelf="flex-start" style={styles.flipAgainContainer}>
              <Kb.Text type="BodySmallSecondaryLink" onClick={this.props.onFlipAgain}>
                Flip again
              </Kb.Text>
            </Kb.Box2>
          )
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    alignSelf: 'flex-start',
    borderColor: Styles.globalColors.greyLight,
    borderLeftWidth: 4,
    borderStyle: 'solid',
    marginTop: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.tiny,
  },
  error: {
    color: Styles.globalColors.redDark,
  },
  flipAgainContainer: {
    paddingTop: Styles.globalMargins.tiny,
  },
  placeholder: {
    backgroundColor: Styles.globalColors.greyLight,
  },
  progress: Styles.platformStyles({
    isElectron: {
      cursor: 'text',
      userSelect: 'text',
      wordBreak: 'break-all',
    },
  }),
  progressVis: {
    height: 40,
    width: 64,
  },
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
  statusContainer: {
    paddingTop: Styles.globalMargins.tiny,
  },
})

export default CoinFlip
