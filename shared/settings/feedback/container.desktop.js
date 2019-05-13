// @flow
import logger from '../../logger'
import * as React from 'react'
import {HOCTimers} from '../../common-adapters'
import Feedback from './index.desktop'
import {compose, connect, type RouteProps} from '../../util/container'
import {version} from '../../constants/platform'
import {writeLogLinesToFile} from '../../util/forward-logs'
import {extraChatLogs, type State, type Props} from './utils'
import * as RPCTypes from '../../constants/types/rpc-gen'

type OwnProps = RouteProps<{}, {}>

class FeedbackContainer extends React.Component<Props, State> {
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
          logger.info(`Sending ${this.state.sendLogs ? 'log' : 'feedback'} to daemon`)
          const extra = this.state.sendLogs ? {...this.props.status, ...this.props.chat} : this.props.status
          return RPCTypes.configLogSendRpcPromise({
            feedback: this.state.feedback || '',
            sendLogs: this.state.sendLogs,
            statusJSON: JSON.stringify(extra),
          })
        })
        .then(logSendId => {
          logger.info('logSendId is', logSendId)
          if (this.mounted) {
            this.setState({
              feedback: null,
              sendError: null,
              sending: false,
              sentFeedback: true,
            })
          }
        })
        .catch(err => {
          logger.warn('err in sending logs', err)
          if (this.mounted) {
            this.setState({
              sendError: err,
              sending: false,
              sentFeedback: false,
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

const mapStateToProps = state => {
  return {
    chat: extraChatLogs(state),
    status: {
      version,
    },
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  title: 'Feedback',
})

const connected = compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...s, ...d})
  ),
  HOCTimers
)(FeedbackContainer)

// $FlowIssue
connected.navigationOptions = {
  header: undefined,
  headerHeight: 60,
  title: 'Feedback',
}

export default connected
