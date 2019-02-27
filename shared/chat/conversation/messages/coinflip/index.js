// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {pluralize} from '../../../../util/string'
import CoinFlipParticipants from './participants'
import Cards from './cards'

type ResultsListType = {|
  list: string,
|}
const ResultsList = (props: ResultsListType): React.Node => {
  const items = props.list.split(',')
  return (
    <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xtiny">
      {items.slice(0, 5).map((item, i) => (
        <Kb.Box2 key={i} direction="horizontal" alignSelf="flex-start" centerChildren={true}>
          <Kb.Box2
            direction="vertical"
            centerChildren={true}
            alignItems="center"
            style={styles.listOrderContainer}
          >
            <Kb.Text
              center={true}
              type={i === 0 ? 'BodyBig' : 'BodyTiny'}
              style={Styles.collapseStyles([styles.listOrder, i === 0 && styles.listOrderFirst])}
            >
              {i + 1}
            </Kb.Text>
          </Kb.Box2>
          <Kb.Markdown
            allowFontScaling={true}
            styleOverride={
              i === 0
                ? {
                    paragraph: {
                      // These are Header's styles.
                      fontSize: Styles.isMobile ? 20 : 18,
                      fontWeight: '700',
                    },
                  }
                : undefined
            }
          >
            {item}
          </Kb.Markdown>
        </Kb.Box2>
      ))}
      {items.length > 5 && (
        <Kb.Box2 direction="horizontal" style={styles.listFullContainer}>
          <Kb.Text type="BodySmallSemibold" style={styles.listFull}>
            Full shuffle:{' '}
            <Kb.Text type="BodySmall" style={styles.listFull}>
              {items.join(', ')}
            </Kb.Text>
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

export type Props = {|
  commitmentVis: string,
  revealVis: string,
  resultText: string,
  isError: boolean,
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
  _formattedResultText = () => {
    if (!this.props.resultText) {
      return <Kb.Text type="BodySmall">Processing…</Kb.Text>
    } else if (this.props.resultText.match(/(♠️|♣️|♦️|♥️)/g)) {
      return <Cards cardsString={this.props.resultText} />
    } else if (this.props.resultText.match(/(heads|tails)/gi)) {
      // replace with heads/tails icon
      return <Kb.Text type="Header">{this.props.resultText}</Kb.Text>
    } else if (this.props.resultText.includes(',')) {
      return <ResultsList list={this.props.resultText} />
    } else {
      // Must be a number.
      return <Kb.Text type="Header">{this.props.resultText}</Kb.Text>
    }
  }
  _getAttachmentRef = () => {
    return this._partRef.current
  }
  _commitmentSummary = () => {
    const total = this.props.participants.length
    const committed = this.props.participants.reduce((r, p) => {
      return r + (p.commitment ? 1 : 0)
    }, 0)
    return `${committed} / ${total}`
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
        {this.props.isError ? (
          <Kb.Text style={styles.error} type="BodyItalic">
            {this.props.progressText}
          </Kb.Text>
        ) : (
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
            <Kb.Box2 direction="vertical">
              {this.props.commitmentVis.length > 0 ? (
                <Kb.Image src={commitSrc} style={styles.progressVis} />
              ) : (
                <Kb.Box2 direction="vertical" style={styles.progressVis} />
              )}
            </Kb.Box2>
            <Kb.Box2 direction="vertical">
              {this.props.revealVis.length > 0 ? (
                <Kb.Image src={revealSrc} style={styles.progressVis} />
              ) : (
                <Kb.Box2 direction="vertical" style={styles.progressVis} />
              )}
            </Kb.Box2>
            <Kb.Box2 direction="vertical">
              {this.props.showParticipants ? (
                <Kb.Box2
                  direction="vertical"
                  onMouseOver={this._showPopup}
                  onMouseLeave={this._hidePopup}
                  ref={this._partRef}
                >
                  <Kb.Text type="BodySmall">Secured by</Kb.Text>
                  <Kb.Text
                    type="BodySmallPrimaryLink"
                    style={styles.participantsLabel}
                    onClick={this._showPopup}
                  >
                    {`${this.props.participants.length} ${pluralize('participant')}`}
                  </Kb.Text>
                  {popup}
                </Kb.Box2>
              ) : (
                <>
                  <Kb.Text type="BodySmallSemibold">
                    Collecting commitments: {this._commitmentSummary()}
                  </Kb.Text>
                  <Kb.Text type="BodySmallSemibold">Collecting secrets: {this._revealSummary()}</Kb.Text>
                  <Kb.Text type="BodySmallSemibold">Verifying cryptography…</Kb.Text>
                </>
              )}
            </Kb.Box2>
          </Kb.Box2>
        )}
        <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.result}>
            {this._formattedResultText()}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    alignSelf: 'flex-start',
    borderLeftColor: Styles.globalColors.lightGrey,
    borderLeftWidth: 4,
    borderStyle: 'solid',
    marginTop: Styles.globalMargins.xtiny,
    // padding: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.tiny,
  },
  error: {
    color: Styles.globalColors.red,
  },
  listFull: {
    color: Styles.globalColors.black,
  },
  listFullContainer: {
    marginTop: Styles.globalMargins.tiny,
  },
  listOrder: {
    color: Styles.globalColors.black,
    height: 14,
    width: 14,
  },
  listOrderContainer: {
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xtiny,
    width: 20,
  },
  listOrderFirst: {
    backgroundColor: Styles.globalColors.black,
    borderRadius: 2,
    color: Styles.globalColors.white,
    height: 18,
    width: 18,
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
  result: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
})

export default CoinFlip
