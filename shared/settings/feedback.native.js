// @flow

import React, {Component} from 'react'
import {globalStyles, globalMargins, globalColors} from '../styles'
import {
  Box,
  Button,
  ButtonBar,
  Checkbox,
  Text,
  Input,
  NativeScrollView,
  NativeKeyboard,
} from '../common-adapters/index.native'

const getOtherErrorInfo = (err: Error) => {
  const info = {}
  for (const k in err) info[k] = (err: Object)[k]
  delete info.name
  delete info.message
  delete info.stack
  return info
}

type Props = {
  onSendFeedbackContained: () => void,
  showSuccessBanner: boolean,
  sendLogs: boolean,
  feedback: ?string,
  heading: ?string,
  sending: boolean,
  sendError: ?Error,
  onChangeSendLogs: (nextValue: boolean) => void,
  onChangeFeedback: (nextValue: ?string) => void,
}

class Feedback extends Component<Props> {
  _scroll: ?NativeScrollView

  _onSubmit = () => {
    NativeKeyboard.dismiss()
    this._scroll && this._scroll.scrollTo({x: 0, y: 0, animated: true})
    this.props.onSendFeedbackContained()
  }

  _setScrollRef = r => {
    this._scroll = r
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.sendError && this.props.sendError !== prevProps.sendError && this._scroll) {
      // Scroll down so that the user sees the error.
      this._scroll && this._scroll.scrollTo({x: 0, y: 300, animated: true})
    }
  }

  render() {
    const {
      showSuccessBanner,
      sendLogs,
      onChangeSendLogs,
      feedback,
      heading,
      onChangeFeedback,
      sending,
      sendError,
    } = this.props
    return (
      <NativeScrollView style={{...globalStyles.flexBoxColumn, flexGrow: 1}} ref={this._setScrollRef}>
        <Box
          style={{
            flex: 0,
            height: globalMargins.large,
            ...globalStyles.flexBoxRow,
            backgroundColor: globalColors.green,
            alignItems: 'center',
            opacity: showSuccessBanner ? 1 : 0,
          }}
        >
          <Text type="BodySemibold" backgroundMode="Success" style={{flex: 1, textAlign: 'center'}}>
            Thanks! Your feedback was sent.
          </Text>
        </Box>
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            flex: 1,
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            marginLeft: globalMargins.small,
            marginRight: globalMargins.small,
            padding: globalMargins.tiny,
          }}
        >
          <Text style={{textAlign: 'center'}} type="HeaderBig">
            {heading}
          </Text>
          <Box
            style={{
              flex: 1,
              ...globalStyles.flexBoxRow,
              paddingTop: globalMargins.medium,
              paddingBottom: globalMargins.small,
            }}
          >
            <Input
              autoCapitalize="sentences"
              autoCorrect={true}
              autoFocus={true}
              style={{flex: 1}}
              hideLabel={true}
              inputStyle={{textAlign: 'left'}}
              multiline={true}
              rowsMin={3}
              hintText="Please tell us what you were doing, your experience, or anything else we should know. Thanks!"
              value={feedback}
              onChangeText={onChangeFeedback}
            />
          </Box>
          <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.small}}>
            <Checkbox
              label=""
              style={{alignItems: 'flex-start', marginRight: globalMargins.tiny}}
              checked={sendLogs}
              onCheck={onChangeSendLogs}
            />
            <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
              <Text type="Body">Include your logs</Text>
              <Text type="BodySmall">
                This includes some private metadata info (e.g., filenames, but not contents) but it will help
                the developers fix bugs more quickly.
              </Text>
            </Box>
          </Box>
          <ButtonBar>
            <Button label="Send" type="Primary" onClick={this._onSubmit} waiting={sending} />
          </ButtonBar>
          {sendError && (
            <Box style={{...globalStyles.flexBoxColumn, marginTop: globalMargins.small}}>
              <Text type="BodyError">Could not send log</Text>
              <Text type="BodySmall" selectable={true} style={{marginTop: 10, marginBottom: 10}}>{`${
                sendError.name
              }: ${sendError.message}`}</Text>
              <Text type="BodySmallSemibold">Stack</Text>
              <Text type="BodySmall" selectable={true} style={{marginTop: 10, marginBottom: 10}}>
                {sendError.stack}
              </Text>
              <Text type="BodySmallSemibold">Error dump</Text>
              <Text type="BodySmall" selectable={true} style={{marginTop: 10, marginBottom: 10}}>
                {JSON.stringify(getOtherErrorInfo(sendError), null, 2)}
              </Text>
            </Box>
          )}
        </Box>
      </NativeScrollView>
    )
  }
}

export default Feedback
