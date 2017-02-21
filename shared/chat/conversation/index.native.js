// @flow

import React from 'react'
import List from './list.native'
import Input from './input.native'
import {Box, Text} from '../../common-adapters'
import {globalStyles} from '../../styles'
import hoc from './index-hoc'

import type {Props} from './index'

const Conversation = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
    <Text type='Body'>
      Convo with {props.participants.join(', ')} - {props.messages.count()}
    </Text>
    <List {...props.listProps} />
    {props.finalizeInfo
      ? <Text type='Body'>Old Profile Reset Notice</Text>
      : <Input {...props.inputProps} /> }
  </Box>
)

export default hoc(Conversation)
