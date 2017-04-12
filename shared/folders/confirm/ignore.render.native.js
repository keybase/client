// @flow
import React from 'react'
import type {Props} from './ignore.render'
import {Confirm, Box, Text, Icon} from '../../common-adapters'
import {globalColors} from '../../styles'
import {usernameText} from '../../common-adapters/usernames'

const Render = ({isPrivate, users, avatar, onSubmit, onCancel}: Props) => {
  const theme = isPrivate ? 'private' : 'public'

  const header = (
    <Box style={{opacity: 0.6}}>
      <Icon type={iconThemed[theme]} />
    </Box>
  )

  const body = (
    <Box>
      <Text type='Header' style={{textAlign: 'center', marginBottom: 16}}>
        <Text type='Header' style={textColorThemed[theme]}>Ignore {isPrivate ? 'private/' : 'public/'}</Text>
        {usernameText({type: 'Header', style: textColorThemed[theme], users})}
        <Text type='Header' style={textColorThemed[theme]}>?</Text>
      </Text>
      <Text type='Body' style={{...textColorThemed[theme], textAlign: 'center'}}>This folder will no longer show up on your computer and you won't receive alerts about it.</Text>
    </Box>
  )

  return <Confirm theme={theme} header={header} body={body} submitLabel='Yes, ignore this folder' onSubmit={onSubmit} onCancel={onCancel} />
}

const textColorThemed = {
  'public': {
    color: globalColors.black_75,
  },
  'private': {
    color: globalColors.white,
  },
}

const iconThemed = {
  'public': 'icon-folder-public-64',
  'private': 'icon-folder-private-64',
}

export default Render
