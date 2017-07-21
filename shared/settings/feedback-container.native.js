// @flow
import React, {Component} from 'react'

import RNFetchBlob from 'react-native-fetch-blob'
import {HeaderHoc, HOCTimers} from '../common-adapters'
import Feedback from './feedback'
import logSend from '../native/log-send'
import {connect} from 'react-redux-profiled'
import {compose, withState, withHandlers} from 'recompose'
import {isAndroid, appVersionName, appVersionCode, mobileOsVersion, version} from '../constants/platform'
import {getLogger} from '../util/periodic-logger'
import {writeStream, exists, cachesDirectoryPath} from '../util/file'
import {serialPromises} from '../util/promise'

import type {Dispatch} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'
import type {TimerProps} from '../common-adapters/hoc-timers'

const FeedbackWrapped = compose(
  withState('sendLogs', 'onChangeSendLogs', true),
  withHandlers({
    onSendFeedbackContained: ({sendLogs, feedback, onSendFeedback}) => () =>
      onSendFeedback(feedback, sendLogs),
  })
)(Feedback)

type State = {
  sentFeedback: boolean,
  feedback: ?string,
  sending: boolean,
}

class FeedbackContainer extends Component<void, {status: string} & TimerProps, State> {
  mounted = false

  state = {
    sentFeedback: false,
    feedback: null,
    sending: false,
  }

  _onChangeFeedback = feedback => {
    this.setState({feedback})
  }

  _dumpLogs = () =>
    new Promise((resolve, reject) => {
      // We don't get the notification from the daemon so we have to do this ourselves
      const logs = []
      console.log('Starting log dump')

      const logNames = ['actionLogger', 'storeLogger']

      logNames.forEach(name => {
        try {
          const logger = getLogger(name)
          logger &&
            logger.dumpAll((...args) => {
              logs.push(args)
            })
        } catch (_) {}
      })

      logs.push(['=============CONSOLE.LOG START============='])
      const logger = getLogger('nativeConsoleLog')
      logger &&
        logger.dumpAll((...args) => {
          // Skip the extra prefixes that period-logger uses.
          logs.push([args[1], ...args.slice(2)])
        })
      logs.push(['=============CONSOLE.LOG END============='])

      const dir = `${cachesDirectoryPath}/Keybase`
      const path = `${dir}/rn.log`
      console.log('Starting log write')

      RNFetchBlob.fs
        .isDir(dir)
        .then(isDir => (isDir ? Promise.resolve() : RNFetchBlob.fs.mkdir(dir)))
        .then(() => exists(path))
        .then(exists => (exists ? Promise.resolve() : RNFetchBlob.fs.createFile(path, '', 'utf8')))
        .then(() => writeStream(path, 'utf8', true))
        .then(stream => {
          const writeLogsPromises = logs.map((log, idx) => {
            return () => {
              return stream.write(JSON.stringify(log, null, 2))
            }
          })

          return serialPromises(writeLogsPromises).then(() => stream.close())
        })
        .then(success => {
          console.log('Log write done')
          resolve(path)
        })
        .catch(err => {
          console.warn(`Couldn't log send! ${err}`)
          reject(err)
        })
    })

  componentWillUnmount() {
    this.mounted = false
  }

  componentDidMount() {
    this.mounted = true
  }

  _onSendFeedback = (feedback, sendLogs) => {
    this.setState({sending: true, sentFeedback: false})

    this.props.setTimeout(() => {
      const maybeDump = sendLogs ? this._dumpLogs() : Promise.resolve('')

      maybeDump
        .then(path => {
          console.log(`Sending ${sendLogs ? 'log' : 'feedback'} to daemon`)
          return logSend(this.props.status, feedback, sendLogs, path)
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
        .catch(err => {
          console.warn('err in sending logs', err)
          if (this.mounted) {
            this.setState({
              sentFeedback: false,
              sending: false,
            })
          }
        })
    }, 0)
  }

  render() {
    return (
      <FeedbackWrapped
        showSuccessBanner={this.state.sentFeedback}
        onSendFeedback={this._onSendFeedback}
        onChangeFeedback={this._onChangeFeedback}
        feedback={this.state.feedback}
        sending={this.state.sending}
      />
    )
  }
}

export default compose(
  connect(
    (state: TypedState) => {
      return {
        status: JSON.stringify({
          username: state.config.username,
          uid: state.config.uid,
          deviceID: state.config.deviceID,
          mobileOsVersion,
          platform: isAndroid ? 'android' : 'ios',
          version,
          appVersionName,
          appVersionCode,
        }),
      }
    },
    (dispatch: Dispatch, {navigateUp}) => ({
      title: 'Feedback',
      onBack: () => dispatch(navigateUp()),
    })
  ),
  HeaderHoc,
  HOCTimers
)(FeedbackContainer)
