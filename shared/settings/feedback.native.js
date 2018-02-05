// @flow

import React, {Component} from 'react'
import {globalStyles, globalMargins, globalColors} from '../styles'
import {
  Box,
  Button,
  ButtonBar,
  Checkbox,
  Icon,
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
  sending: boolean,
  sendError: ?Error,
  onChangeSendLogs: (nextValue: boolean) => void,
  onChangeFeedback: (nextValue: ?string) => void,
}

class Feedback extends Component<Props> {
  _scroll: any

  _onSubmit = () => {
    NativeKeyboard.dismiss()
    this._scroll && this._scroll.scrollTo({x: 0, y: 0, animated: true})
    this.props.onSendFeedbackContained()
  }

  _setScrollRef = r => {
    this._scroll = r
  }

  render() {
    const {
      showSuccessBanner,
      sendLogs,
      onChangeSendLogs,
      feedback,
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
          <Icon
            type="icon-fancy-feedback-96"
            style={{height: 96, width: 96, alignSelf: 'center', marginBottom: globalMargins.tiny}}
          />
          <Text style={{textAlign: 'center'}} type="BodySemibold">
            Please send us any feedback or describe any bugs you’ve encountered.
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
              style={{flex: 1}}
              inputStyle={{textAlign: 'left'}}
              multiline={true}
              small={true}
              rowsMin={2}
              hintText="Write a comment"
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
              <Text
                type="BodySmall"
                style={{...globalStyles.selectable, marginTop: 10, marginBottom: 10}}
              >{`${sendError.name}: ${sendError.message}`}</Text>
              <Text type="BodySmallSemibold">Stack</Text>
              <Text type="BodySmall" style={{...globalStyles.selectable, marginTop: 10, marginBottom: 10}}>
                {sendError.stack}
              </Text>
              <Text type="BodySmallSemibold">Error dump</Text>
              <Text type="BodySmall" style={{...globalStyles.selectable, marginTop: 10, marginBottom: 10}}>
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
