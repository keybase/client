// @flow
import React, {Component} from 'react'

import {HeaderHoc} from '../common-adapters'
import Feedback from './feedback'
import logSend from '../native/log-send'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'
import {isElectron, isIOS} from '../constants/platform'
import {dumpLoggers} from '../util/periodic-logger'
import {writeStream, cachesDirectoryPath} from '../util/file'
import {serialPromises} from '../util/promise'

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
      console.log('Starting log dump')
      dumpLoggers((...args) => {
        try {
          logs.push(args)
        } catch (_) {}
      })

      const path = `${cachesDirectoryPath}/Keybase/rn.log`
      console.log('Starting log write')

      writeStream(path, 'utf8').then(stream => {
        const writeLogsPromises = logs.map((log, idx) => {
          return () => {
            console.log(`Writing log # ${idx + 1}`)
            return stream.write(JSON.stringify(log, null, 2))
          }
        })

        return serialPromises(writeLogsPromises).then(() => stream.close())
      }).then((success) => {
        console.log('Log write done')
        resolve(true)
      })
      .catch((err) => {
        resolve(false)
        console.warn(`Couldn't log send! ${err}`)
      })
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

  _onSendFeedback = (feedback, sendLogs) => {
    this.setState({sending: true, sentFeedback: false})

    const maybeDump = sendLogs ? this._dumpLogs() : Promise.resolve()

    maybeDump.then(() => {
      console.log(`Sending ${sendLogs ? 'log' : 'feedback'} to daemon`)
      return logSend(feedback, sendLogs)
    })
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

  render () {
    return <FeedbackWrapped showSuccessBanner={this.state.sentFeedback} onSendFeedback={this._onSendFeedback} onChangeFeedback={this._onChangeFeedback} feedback={this.state.feedback} sending={this.state.sending} />
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
