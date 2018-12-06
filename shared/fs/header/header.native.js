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
        icon: 'chat',
        onPress: onChat,
      } : {},
      {
        custom: <AddNew path={path} />,
      },
    ]}
    title={title}
  />
)

export default Header
