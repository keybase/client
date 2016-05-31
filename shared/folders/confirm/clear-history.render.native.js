// @flow

import React from 'react'
import type {Props} from './clear-history.render'
import {Confirm, Box, Text, Icon} from '../../common-adapters'
import {headerBoxStyle} from '../../common-adapters/confirm.native'
import {usernameText} from '../../common-adapters/usernames'
import {globalColors} from '../../styles/style-guide'

const Render = ({isPrivate, users, folderSize, onSubmit, onCancel}: Props) => {
  const theme = isPrivate ? 'private' : 'public'
  return (
    <Confirm theme={theme} danger submitLabel='Yes, clear history' onSubmit={onSubmit} onCancel={onCancel}>
      <Box style={headerBoxStyle}>
        <Icon type='history-clear-64' />
      </Box>
      <Box style={{marginBottom: 16}}>
        <Text type='Header' style={{textAlign: 'center'}}>
          <Text type='Header' style={textColorThemed[theme]}>Clear history for {isPrivate ? 'private/' : 'public/'}</Text>
          {usernameText({type: 'Header', style: textColorThemed[theme], users})}
          <Text type='Header' style={textColorThemed[theme]}>? ({folderSize})</Text>
        </Text>
      </Box>
      <Text type='Body' style={{...textColorThemed[theme], textAlign: 'center'}}>This folder will no longer show up on your computer and you won't receive alerts about it.</Text>
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
