// @flow

import React from 'react'
import type {Props} from './ignore.render'
import {Confirm, Box, Text, Icon, Avatar, Usernames} from '../../common-adapters'
import {globalColors} from '../../styles/style-guide'

const Render = ({isPrivate, users, avatar, onSubmit, onCancel}: Props) => {
  const theme = isPrivate ? 'private' : 'public'

  const header = (
    <Box style={{width: 63, height: 63, position: 'relative', opacity: 0.6}}>
      <Icon type={iconThemed[theme]} style={{position: 'absolute', left: 0, top: 0}} />
      <Avatar size={32} username={avatar} style={{...styleAvatar, borderColor: borderColorThemed[theme]}} />
    </Box>
  )

  const body = (
    <Box style={{textAlign: 'center'}}>
      <Box style={{marginBottom: 8}}>
        <Text type='Header' style={textColorThemed[theme]}>Ignore {isPrivate ? 'private/' : 'public/'}</Text>
        <Usernames type='Header' style={textColorThemed[theme]} inline users={users} />
        <Text type='Header' style={textColorThemed[theme]}>?</Text>
      </Box>
      <Text type='Body' style={textColorThemed[theme]}>This folder will no longer show up on your computer and you won't receive alerts about it.</Text>
    </Box>
  )

  return (
    <Confirm theme={theme} header={header} body={body} submitLabel='Yes, ignore this folder' onSubmit={onSubmit} onCancel={onCancel} />
  )
}

const styleAvatar = {
  borderWidth: 3,
  borderStyle: 'solid',
  borderRadius: 19,
  boxSizing: 'content-box',
  position: 'absolute',
  right: 0,
  bottom: 0,
}

const textColorThemed = {
  'public': {
    color: globalColors.black_75,
  },
  'private': {
    color: globalColors.white,
  },
}

const borderColorThemed = {
  'public': globalColors.white,
  'private': globalColors.darkBlue3,
}

const iconThemed = {
  'public': 'icon-folder-public-48',
  'private': 'icon-folder-private-48',
}

export default Render
