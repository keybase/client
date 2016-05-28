// @flow

import React from 'react'
import type {Props} from './clear-history.render'
import {Confirm, Box, Text, Icon, Usernames} from '../../common-adapters'
import {globalColors} from '../../styles/style-guide'

const Render = ({isPrivate, users, folderSize, onSubmit, onCancel}: Props) => {
  const theme = isPrivate ? 'private' : 'public'
  return (
    <Confirm theme={theme} danger submitLabel='Yes, clear history' onSubmit={onSubmit} onCancel={onCancel}>
      <Icon type='history-clear-48' style={{marginBottom: 16}} />
      <Box style={{textAlign: 'center', marginBottom: 8}}>
        <Text type='Header' style={textColorThemed[theme]}>Clear history for {isPrivate ? 'private/' : 'public/'}</Text>
        <Usernames type='Header' style={textColorThemed[theme]} inline users={users} />
        <Text type='Header' style={textColorThemed[theme]}>?</Text>
        <Text type='Header' style={{...textColorThemed[theme], whiteSpace: 'pre'}}> ({folderSize})</Text>
      </Box>
      <Text type='Body' style={{...textColorThemed[theme], textAlign: 'center'}}>This folder will no longer show up in your Finder and you won't receive alerts about it.</Text>
    </Confirm>
  )
}

const textColorThemed = {
  'public': {
    color: globalColors.black_75
  },
  'private': {
    color: globalColors.white
  }
}

export default Render
