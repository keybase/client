// @flow

import React from 'react'
import {globalStyles, globalMargins, globalColors} from '../styles'
import {Box, Button, Checkbox, Icon, Text, Input} from '../common-adapters'

import type {Props} from './feedback'

const Feedback = ({onSendFeedbackContained, showSuccessBanner, sendLogs, onChangeSendLogs, feedback, onChangeFeedback}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginBottom: globalMargins.medium}}>
    {showSuccessBanner &&
      <Box style={{flex: 0, height: 40, ...globalStyles.flexBoxRow, backgroundColor: globalColors.green, alignItems: 'center'}}>
        <Text type='BodySemibold' backgroundMode='Success' style={{flex: 1, textAlign: 'center'}}>Thanks! Your feedback was sent.</Text>
      </Box>}
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, alignItems: 'center', justifyContent: 'center', marginLeft: globalMargins.small, marginRight: globalMargins.small}}>
      <Icon type='icon-fancy-feedback-96' style={{height: 96, width: 96, marginTop: globalMargins.medium, marginBottom: globalMargins.medium}} />
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
      <Button label='Send' type='Primary' onClick={onSendFeedbackContained} style={{marginTop: globalMargins.small}} />
    </Box>
  </Box>
)

export default Feedback
