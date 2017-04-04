// @flow

import React from 'react'
import {globalStyles, globalMargins, globalColors} from '../styles'
import {Box, Button, Checkbox, Icon, Text, Input, NativeScrollView} from '../common-adapters'

import type {Props} from './feedback'

const Feedback = ({onSendFeedbackContained, showSuccessBanner, sendLogs, onChangeSendLogs, feedback, onChangeFeedback}: Props) => (
  <NativeScrollView style={{...globalStyles.flexBoxColumn, flex: 1}}>
    {showSuccessBanner &&
      <Box style={{flex: 0, height: 40, ...globalStyles.flexBoxRow, backgroundColor: globalColors.green, alignItems: 'center'}}>
        <Text type='BodySemibold' backgroundMode='Success' style={{flex: 1, textAlign: 'center'}}>Thanks! Your feedback was sent.</Text>
      </Box>}
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, alignItems: 'stretch', justifyContent: 'flex-start', marginLeft: globalMargins.small, marginRight: globalMargins.small}}>
      <Icon type='icon-fancy-feedback-96' style={{height: 96, width: 96, marginTop: globalMargins.medium, marginBottom: globalMargins.medium, alignSelf: 'center'}} />
      <Text style={{textAlign: 'center'}} type='Body'>Please send us any feedback or describe any bugs you’ve encountered.</Text>
      <Box style={{flex: 1, ...globalStyles.flexBoxRow}}>
        <Input
          style={{flex: 1}}
          inputStyle={{textAlign: 'left'}}
          multiline={true}
          small={true}
          rowsMin={4}
          hintText='Write a comment'
          value={feedback}
          onChangeText={onChangeFeedback}
        />
      </Box>
      <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.small}}>
        <Checkbox
          label=''
          style={{alignItems: 'flex-start'}}
          checked={sendLogs}
          onCheck={onChangeSendLogs}
        />
        <Box style={{...globalStyles.flexBoxColumn}}>
          <Text type='Body'>Include my logs</Text>
          <Text type='BodySmall'>This includes some metadata info but it will help the developers fix bugs quicker.</Text>
        </Box>
      </Box>
      <Box style={{alignSelf: 'center', marginTop: globalMargins.small}}>
        <Button label='Send' type='Primary' onClick={onSendFeedbackContained} />
      </Box>
    </Box>
  </NativeScrollView>
)

export default Feedback
