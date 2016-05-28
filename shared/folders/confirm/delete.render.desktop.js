// @flow

import React from 'react'
import type {Props} from './delete.render'
import {Confirm, Box, Text, Icon, Usernames} from '../../common-adapters'
import {globalColors} from '../../styles/style-guide'

const Render = ({isPrivate, users, folderSize, onSubmit, onCancel}: Props) => {
  const theme = isPrivate ? 'private' : 'public'
  return (
    <Confirm theme={theme} danger submitLabel='Yes, delete it' onSubmit={onSubmit} onCancel={onCancel}>
      <Icon type={iconThemed[theme]} style={{marginBottom: 16}} />
      <Box style={{textAlign: 'center', marginBottom: 8}}>
        <Text type='Header' style={textColorThemed[theme]}>Delete files and clear history for {isPrivate ? 'private/' : 'public/'}</Text>
        <Usernames type='Header' style={textColorThemed[theme]} inline users={users} />
        <Text type='Header' style={textColorThemed[theme]}>?</Text>
        <Text type='Header' style={{...textColorThemed[theme], whiteSpace: 'pre'}}> ({folderSize})</Text>
      </Box>
      <Text type='Body' style={{...textColorThemed[theme], textAlign: 'center'}}>Deletes everything in this folder, including the backup versions.</Text>
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

const iconThemed = {
  'public': 'files-public-delete-48',
  'private': 'files-private-delete-48'
}

export default Render
