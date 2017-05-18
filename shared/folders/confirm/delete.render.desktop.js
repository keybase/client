// @flow
import React from 'react'
import type {IconType} from '../../common-adapters/icon'
import type {Props} from './delete.render'
import {Confirm, Box, Text, Icon, Usernames} from '../../common-adapters'
import {globalColors} from '../../styles'

const Render = ({isPrivate, users, folderSize, onSubmit, onCancel}: Props) => {
  const theme = isPrivate ? 'private' : 'public'
  const icon: IconType = isPrivate ? 'icon-files-private-delete-48' : 'icon-files-public-delete-48'
  const header = <Icon type={icon} />

  const body = (
    <Box style={{textAlign: 'center'}}>
      <Box style={{marginBottom: 8}}>
        <Text type="Header" style={textColorThemed[theme]}>
          Delete files and clear history for {isPrivate ? 'private/' : 'public/'}
        </Text>
        <Usernames type="Header" inline={true} style={textColorThemed[theme]} users={users} />
        <Text type="Header" style={textColorThemed[theme]}>?</Text>
        <Text type="Header" style={{...textColorThemed[theme], whiteSpace: 'pre'}}> ({folderSize})</Text>
      </Box>
      <Text type="Body" style={textColorThemed[theme]}>
        Deletes everything in this folder, including the backup versions.
      </Text>
    </Box>
  )
  return (
    <Confirm
      theme={theme}
      danger={true}
      header={header}
      body={body}
      submitLabel="Yes, delete it"
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  )
}

const textColorThemed = {
  public: {
    color: globalColors.black_75,
  },
  private: {
    color: globalColors.white,
  },
}

export default Render
