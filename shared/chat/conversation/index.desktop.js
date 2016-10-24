// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import {globalStyles} from '../../styles'
import Header from './header.desktop'
import List from './list.desktop'
import Input from './input.desktop'
import TEMP from './temp.desktop'

const {ChatClass} = TEMP

import type {Props} from '.'

const Conversation = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
    <Header {...props} />
    <List {...props} />
    <ChatClass />
    <Input {...props} />
  </Box>
)

export default Conversation
