// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import AddNew from './add-new-container'
import {type FolderHeaderProps} from './header'

const Header = ({title, path, onBack, onChat}: FolderHeaderProps) => (
  <Kb.HeaderHocHeader
    onLeftAction={onBack}
    rightActions={[
      {
        custom: <AddNew path={path} />,
        label: 'Add new…',
      },
      onChat
        ? {
            icon: 'iconfont-chat',
            label: 'Chat',
            onPress: onChat,
          }
        : null,
    ]}
    title={title}
  />
)

export default Header
