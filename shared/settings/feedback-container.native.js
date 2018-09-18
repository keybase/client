// @flow
import logger from '../logger'
import * as I from 'immutable'
import * as ChatConstants from '../constants/chat2'
import React, {Component} from 'react'
import {HeaderHoc, HOCTimers, type PropsWithTimer} from '../common-adapters'
import Feedback from './feedback.native'
import logSend from '../native/log-send'
import {compose, connect, type TypedState} from '../util/container'
import {
  isAndroid,
  appVersionName,
  appVersionCode,
  mobileOsVersion,
  version,
  logFileName,
  pprofDir,
} from '../constants/platform'
import {writeLogLinesToFile} from '../util/forward-logs'

type State = {
  sentFeedback: boolean,
  feedback: ?string,
  sending: boolean,
  sendLogs: boolean,
  sendError: ?Error,
}

type Props = PropsWithTimer<{
  status: Object,
  heading: ?string,
  chat: Object,
}>

class FeedbackContainer extends Component<Props, State> {
  mounted = false

  state = {
    feedback: null,
    sendError: null,
    sendLogs: true,
    sending: false,
    sentFeedback: false,
  }

  _onChangeSendLogs = (sendLogs: boolean) => this.setState({sendLogs})

  _onChangeFeedback = feedback => {
    this.setState({feedback})
  }

  _dumpLogs = () => logger.dump().then(writeLogLinesToFile)

  componentWillUnmount() {
    this.mounted = false
  }

  componentDidMount() {
    this.mounted = true
  }

  _onSendFeedback = () => {
    this.setState({sending: true, sentFeedback: false})

    this.props.setTimeout(() => {
      const maybeDump = this.state.sendLogs ? this._dumpLogs() : Promise.resolve('')

      maybeDump
        .then(() => {
          const logPath = logFileName()
          logger.info(`Sending ${this.state.sendLogs ? 'log' : 'feedback'} to daemon`)
          const extra = this.state.sendLogs ? {...this.props.status, ...this.props.chat} : this.props.status
          const traceDir = pprofDir()
          const cpuProfileDir = traceDir
          return logSend(
            JSON.stringify(extra),
            this.state.feedback || '',
            this.state.sendLogs,
            logPath,
            traceDir,
            cpuProfileDir
          )
        })
        .then(logSendId => {
          logger.info('logSendId is', logSendId)
          if (this.mounted) {
            this.setState({
              sentFeedback: true,
              feedback: null,
              sending: false,
              sendError: null,
            })
          }
        })
        .catch(err => {
          logger.warn('err in sending logs', err)
          if (this.mounted) {
            this.setState({
              sentFeedback: false,
              sending: false,
              sendError: err,
            })
          }
        })
    }, 0)
  }

  render() {
    return (
      <Feedback
        showSuccessBanner={this.state.sentFeedback}
        onSendFeedbackContained={this._onSendFeedback}
        onChangeFeedback={this._onChangeFeedback}
        feedback={this.state.feedback}
        heading={this.props.heading}
        sending={this.state.sending}
        sendError={this.state.sendError}
        sendLogs={this.state.sendLogs}
        onChangeSendLogs={this._onChangeSendLogs}
      />
    )
  }
}

const extraChatLogs = (state: TypedState) => {
  const chat = state.chat2
  const c = state.chat2.selectedConversation
  if (c) {
    const metaMap: Object = ChatConstants.getMeta(state, c).toJS()
    return I.Map({
      badgeMap: chat.badgeMap.get(c),
      editingMap: chat.editingMap.get(c),
      messageMap: chat.messageMap.get(c, I.Map()).map(m => ({
        a: m.author,
        i: m.id,
        o: m.ordinal,
        out: (m.type === 'text' || m.type === 'attachment') && m.outboxID,
        s: (m.type === 'text' || m.type === 'attachment') && m.submitState,
        t: m.type,
      })),
      messageOrdinals: chat.messageOrdinals.get(c),
      metaMap: {
        channelname: 'x',
        conversationIDKey: metaMap.conversationIDKey,
        description: 'x',
        inboxVersion: metaMap.inboxVersion,
        isMuted: metaMap.isMuted,
        membershipType: metaMap.membershipType,
        notificationsDesktop: metaMap.notificationsDesktop,
        notificationsGlobalIgnoreMentions: metaMap.notificationsGlobalIgnoreMentions,
        notificationsMobile: metaMap.notificationsMobile,
        offline: metaMap.offline,
        participants: 'x',
        rekeyers: metaMap.rekeyers && metaMap.rekeyers.size,
        resetParticipants: metaMap.resetParticipants && metaMap.resetParticipants.size,
        retentionPolicy: metaMap.retentionPolicy,
        snippet: 'x',
        snippetDecoration: 'x',
        supersededBy: metaMap.supersededBy,
        supersedes: metaMap.supersedes,
        teamRetentionPolicy: metaMap.teamRetentionPolicy,
        teamType: metaMap.teamType,
        teamname: metaMap.teamname,
        timestamp: metaMap.timestamp,
        tlfname: metaMap.tlfname,
        trustedState: metaMap.trustedState,
        wasFinalizedBy: metaMap.wasFinalizedBy,
      },
      pendingMode: chat.pendingMode,
      pendingOutboxToOrdinal: chat.pendingOutboxToOrdinal.get(c),
      quote: chat.quote,
      unreadMap: chat.unreadMap.get(c),
    }).toJS()
  }
  return {}
}

// TODO really shouldn't be doing this in connect, should do this with an action
const mapStateToProps = (state: TypedState, {routeProps}) => {
  return {
    chat: extraChatLogs(state),
    heading: routeProps.get('heading') || 'Your feedback is welcomed!',
    status: {
      appVersionCode,
      appVersionName,
      deviceID: state.config.deviceID,
      mobileOsVersion,
      platform: isAndroid ? 'android' : 'ios',
      uid: state.config.uid,
      username: state.config.username,
      version,
    },
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  title: 'Feedback',
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  HeaderHoc,
  HOCTimers
)(FeedbackContainer)
