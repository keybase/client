// @flow
import React, {Component} from 'react'

import {HeaderHoc} from '../common-adapters'
import Feedback from './feedback'
import logSend from '../native/log-send'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'
import {isElectron, isIOS} from '../constants/platform'
import {dumpLoggers} from '../util/periodic-logger'
import {writeFile, cachesDirectoryPath} from '../util/file'

import type {Dispatch} from '../constants/types/flux'

const FeedbackWrapped = compose(
  withState('sendLogs', 'onChangeSendLogs', true),
  withHandlers({
    onSendFeedbackContained: ({sendLogs, feedback, onSendFeedback}) => () => onSendFeedback(feedback, sendLogs),
  })
)(Feedback)

type State = {
  sentFeedback: boolean,
  feedback: ?string,
  sending: boolean,
}

class FeedbackContainer extends Component<void, {}, State> {
  mounted = false

  state = {
    sentFeedback: false,
    feedback: null,
    sending: false,
  }

  _onChangeFeedback = (feedback) => {
    this.setState({feedback})
  }

  _dumpLogs = () => new Promise((resolve, reject) => {
    // This isn't used on desktop yet, but we'll likely have to dump the logs there too
    if (isElectron) {
      reject(new Error('Not implemented on Desktop!'))
    }

    if (isIOS) {
      // We don't get the notification from the daemon so we have to do this ourselves
      const logs = []
      dumpLoggers((...args) => {
        try {
          logs.push(JSON.stringify(args, null, 2))
        } catch (_) {}
      })

      const data = logs.join('\n')
      const path = `${cachesDirectoryPath}/Keybase/rn.log`

      // Don't hose the UI thread, give ourselves some breathing room before we write else we
      // won't see the Send spinner
      setTimeout(() => {
        writeFile(path, data, 'utf8')
          .then((success) => {
            resolve(true)
          })
          .catch((err) => {
            resolve(false)
            console.warn(`Couldn't log send! ${err}`)
          })
      }, 1000)
    } else {
      dumpLoggers()
      resolve(true)
    }
  })

  componentWillUnmount () {
    this.mounted = false
  }

  componentDidMount () {
    this.mounted = true
  }

  render () {
    const onSendFeedback = (feedback, sendLogs) => {
      this.setState({sending: true, sentFeedback: false})
      this._dumpLogs()
        .then(() => logSend(feedback, sendLogs))
        .then(logSendId => {
          console.warn('logSendId is', logSendId)
          if (this.mounted) {
            this.setState({
              sentFeedback: true,
              feedback: null,
              sending: false,
            })
          }
        })
    }

    return <FeedbackWrapped showSuccessBanner={this.state.sentFeedback} onSendFeedback={onSendFeedback} onChangeFeedback={this._onChangeFeedback} feedback={this.state.feedback} sending={this.state.sending} />
  }
}

export default compose(
  connect(
  null,
  (dispatch: Dispatch, {navigateUp}) => ({
    title: 'Feedback',
    onBack: () => dispatch(navigateUp()),
  })
  ),
  HeaderHoc
)(FeedbackContainer)
