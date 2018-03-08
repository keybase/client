// @flow
import logger from '../logger'
import * as I from 'immutable'
import React, {Component} from 'react'
import {HeaderHoc, HOCTimers} from '../common-adapters'
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
  traceDir,
} from '../constants/platform'
import {type TimerProps} from '../common-adapters/hoc-timers'
import {writeLogLinesToFile} from '../util/forward-logs'

type State = {
  sentFeedback: boolean,
  feedback: ?string,
  sending: boolean,
  sendLogs: boolean,
  sendError: ?Error,
}

type Props = {
  status: Object,
  chat: Object,
} & TimerProps

class FeedbackContainer extends Component<Props, State> {
  mounted = false

  state = {
    sentFeedback: false,
    feedback: null,
    sending: false,
    sendLogs: true,
    sendError: null,
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
          return logSend(
            JSON.stringify(extra),
            this.state.feedback || '',
            this.state.sendLogs,
            logPath,
            traceDir()
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
    return I.Map({
      badgeMap: chat.badgeMap.get(c),
      editingMap: chat.editingMap.get(c),
      loadingMap: chat.loadingMap,
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
        ...chat.metaMap.get(c, I.Map()).toJS(),
        channelname: 'X',
        snippet: 'X',
      },
      pendingMode: chat.pendingMode,
      pendingOutboxToOrdinal: chat.pendingOutboxToOrdinal.get(c),
      pendingSelected: chat.pendingSelected,
      unreadMap: chat.unreadMap.get(c),
    }).toJS()
  }
  return {}
}

// TODO really shouldn't be doing this in connect, should do this with an action
const mapStateToProps = (state: TypedState) => {
  return {
    chat: extraChatLogs(state),
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

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  title: 'Feedback',
})

export default compose(connect(mapStateToProps, mapDispatchToProps), HeaderHoc, HOCTimers)(FeedbackContainer)
