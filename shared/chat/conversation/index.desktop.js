// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import {globalStyles} from '../../styles'
import Header from './header.desktop'
import List from './list.desktop'
import Input from './input.desktop'

const Conversation = () => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
    <Header />
    <List />
    <Input />
  </Box>
)

export default Conversation
