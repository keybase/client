// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import {type FolderHeaderProps} from './header'
import AddNew from './add-new-container'

const Header = ({title, path, onBack, onChat}: FolderHeaderProps) => (
  <Kb.HeaderHocHeader
    onBack={onBack}
    rightActions={[
      onChat ? {
        icon: 'iconfont-chat',
        label: 'Chat',
        onPress: onChat,
      } : null,
      {
        custom: <AddNew path={path} />,
        label: 'Add new…',
      },
    ]}
    title={title}
  />
)

export default Header
