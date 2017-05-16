// @flow
import RNFetchBlob from 'react-native-fetch-blob'
import React, {Component} from 'react'
import {Box, Text, Button, NativeLinking, NativeClipboard} from '../../common-adapters/index.native'
import {dumpLoggers} from '../../util/periodic-logger'
import {tmpFile} from '../../util/file'
import {globalStyles} from '../../styles'
import {isIOS} from '../../constants/platform'

import type {Props} from './render'

class LogSendRender extends Component<void, Props, {copiedToClipboard: boolean}> {
  state = {
    copiedToClipboard: false,
  }

  _copyToClipboard = () => {
    NativeClipboard.setString(this.props.logSendId || '')
    this.setState({copiedToClipboard: true})
  }

  _logSend = () => {
    if (isIOS) {
      // We don't get the notification from the daemon so we have to do this ourselves
      const logs = []
      dumpLoggers((...args) => {
        try {
          logs.push(JSON.stringify(args))
        } catch (_) {}
      })

      const data = logs.join('\n')
      const path = tmpFile('/Keybase/rn.log')

      RNFetchBlob.fs
        .writeFile(path, data, 'utf8')
        .then(success => {
          this.props.onLogSend()
        })
        .catch(err => {
          this.props.onLogSend()
          throw new Error(`Couldn't log send! ${err}`)
        })
    } else {
      dumpLoggers()
      this.props.onLogSend()
    }
  }

  render() {
    const onSubmitIssue = () => {
      NativeLinking.openURL(
        `https://github.com/keybase/client/issues/new?body=[write%20something%20useful%20and%20descriptive%20here]%0A%0Amy%20log%20id:%20${this.props.logSendId || ''}`
      )
    }

    if (!this.props.logSendId) {
      return (
        <Box style={stylesContainer}>
          <Text type="Body">Send debug logs?</Text>
          <Text type="Body" style={stylesInfoText}>
            This command will send recent Keybase log entries to keybase.io for debugging purposes only. These logs don't include your private keys or encrypted data, but they will include filenames and other metadata Keybase normally can't read, for debugging purposes.
          </Text>
          <Button type="Primary" label="Send a log!" onClick={this._logSend} />
        </Box>
      )
    } else {
      return (
        <Box style={stylesContainer}>
          <Text type="Body">Your log id is:</Text>
          <Text type="Terminal" onClick={this._copyToClipboard}>
            {this.props.logSendId} (tap to copy)
          </Text>
          {this.state.copiedToClipboard &&
            <Text type="Body" style={{marginBottom: 5, marginTop: 5}}>Copied to clipboard!</Text>}

          <Text type="Body">
            Send us the log id along with a description of what's going on in this Github issue:
          </Text>
          <Button type="Primary" label="File a Github issue:" onClick={onSubmitIssue} />
        </Box>
      )
    }
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'space-between',
  margin: 20,
}

const stylesInfoText = {
  marginBottom: 20,
  marginTop: 20,
}

export default LogSendRender
