// @flow

import React from 'react'
import type {Props} from './clear-history.render'
import {Confirm, Box, Text, Icon, Usernames} from '../../common-adapters'
import {globalColors} from '../../styles/style-guide'

const Render = ({isPrivate, users, folderSize, onSubmit, onCancel}: Props) => {
  const theme = isPrivate ? 'private' : 'public'

  const header = <Icon type='history-clear-48' />

  const body = (
    <Box style={{textAlign: 'center'}}>
      <Box style={{marginBottom: 8}}>
        <Text type='Header' style={textColorThemed[theme]}>Clear history for {isPrivate ? 'private/' : 'public/'}</Text>
        <Usernames type='Header' style={textColorThemed[theme]} inline users={users} />
        <Text type='Header' style={textColorThemed[theme]}>?</Text>
        <Text type='Header' style={{...textColorThemed[theme], whiteSpace: 'pre'}}> ({folderSize})</Text>
      </Box>
      <Text type='Body' style={textColorThemed[theme]}>This folder will no longer show up on your computer and you won't receive alerts about it.</Text>
    </Box>
  )

  return (
    <Confirm theme={theme} danger header={header} body={body} submitLabel='Yes, clear history' onSubmit={onSubmit} onCancel={onCancel} />
  )
}

const textColorThemed = {
  'public': {
    color: globalColors.black_75,
  },
  'private': {
    color: globalColors.white,
  },
}

export default Render
