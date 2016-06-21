// @flow

import React from 'react'
import type {Props} from './clear-history.render'
import {Confirm, Box, Text, Icon} from '../../common-adapters'
import {usernameText} from '../../common-adapters/usernames'
import {globalColors} from '../../styles/style-guide'

const Render = ({isPrivate, users, folderSize, onSubmit, onCancel}: Props) => {
  const theme = isPrivate ? 'private' : 'public'

  const header = <Icon type='history-clear-64' />

  const body = (
    <Box>
      <Text type='Header' style={{textAlign: 'center', marginBottom: 16}}>
        <Text type='Header' style={textColorThemed[theme]}>Clear history for {isPrivate ? 'private/' : 'public/'}</Text>
        {usernameText({type: 'Header', style: textColorThemed[theme], users})}
        <Text type='Header' style={textColorThemed[theme]}>? ({folderSize})</Text>
      </Text>
      <Text type='Body' style={{...textColorThemed[theme], textAlign: 'center'}}>This folder will no longer show up on your computer and you won't receive alerts about it.</Text>
    </Box>
  )

  return <Confirm theme={theme} danger header={header} body={body} submitLabel='Yes, clear history' onSubmit={onSubmit} onCancel={onCancel} />
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
