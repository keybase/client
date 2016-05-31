// @flow

import React from 'react'
import type {Props} from './ignore.render'
import {Confirm, Box, Text, Icon, Avatar} from '../../common-adapters'
import {headerBoxStyle} from '../../common-adapters/confirm.native'
import {usernameText} from '../../common-adapters/usernames'
import {globalColors} from '../../styles/style-guide'

const Render = ({isPrivate, users, avatar, onSubmit, onCancel}: Props) => {
  const theme = isPrivate ? 'private' : 'public'
  return (
    <Confirm theme={theme} submitLabel='Yes, ignore this folder' onSubmit={onSubmit} onCancel={onCancel}>
      <Box style={headerBoxStyle}>
        <Box style={{width: 84, height: 84, position: 'relative', opacity: 0.6}}>
          <Icon type={iconThemed[theme]} style={{position: 'absolute', left: 0, top: 0}} />
          <Avatar size={48} username={avatar} style={{...styleAvatar, borderColor: borderColorThemed[theme]}} />
        </Box>
      </Box>
      <Box style={{marginBottom: 16}}>
        <Text type='Header' style={{textAlign: 'center'}}>
          <Text type='Header' style={textColorThemed[theme]}>Ignore {isPrivate ? 'private/' : 'public/'}</Text>
          {usernameText({type: 'Header', style: textColorThemed[theme], users})}
          <Text type='Header' style={textColorThemed[theme]}>?</Text>
        </Text>
      </Box>
      <Text type='Body' style={{...textColorThemed[theme], textAlign: 'center'}}>This folder will no longer show up on your computer and you won't receive alerts about it.</Text>
    </Confirm>
  )
}

const styleAvatar = {
  borderWidth: 3,
  borderStyle: 'solid',
  borderRadius: 35,
  position: 'absolute',
  right: 0,
  bottom: 0
}

const textColorThemed = {
  'public': {
    color: globalColors.black_75
  },
  'private': {
    color: globalColors.white
  }
}

const borderColorThemed = {
  'public': globalColors.white,
  'private': globalColors.darkBlue3
}

const iconThemed = {
  'public': 'folder-public-64',
  'private': 'folder-private-64'
}

export default Render
