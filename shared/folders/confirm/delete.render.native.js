// @flow
import * as React from 'react'
import type {IconType} from '../../common-adapters/icon'
import type {Props} from './delete.render'
import {Confirm, Box, Text, Icon} from '../../common-adapters'
import {globalColors} from '../../styles'
import {usernameText} from '../../common-adapters/usernames'

const Render = ({isPrivate, users, folderSize, onSubmit, onCancel}: Props) => {
  const theme = isPrivate ? 'private' : 'public'

  const icon: IconType = isPrivate ? 'icon-files-private-delete-64' : 'icon-files-public-delete-64'
  const header = <Icon type={icon} />

  const body = (
    <Box>
      <Text type="Header" style={{textAlign: 'center', marginBottom: 16}}>
        <Text type="Header" style={textColorThemed[theme]}>
          Delete files and clear history for {isPrivate ? 'private/' : 'public/'}
        </Text>
        {usernameText({type: 'Header', style: textColorThemed[theme], users})}
        <Text type="Header" style={textColorThemed[theme]}>? ({folderSize})</Text>
      </Text>
      <Text type="Body" style={{...textColorThemed[theme], textAlign: 'center'}}>
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
