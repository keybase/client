// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import TextView from './text-view'
import ImageView from './image-view'
import DefaultView from './default-view-container'
import {Text} from '../../common-adapters'

export const getDisplayComponent = (path: Types.Path, fileViewType: Types.FileViewType) => {
  switch (fileViewType) {
    case 'text':
      return <TextView url="https://keybase.io/warp/release.txt" />
    case 'image':
      return <ImageView url="https://keybase.io/images/blog/teams/teams-splash-announcement.png" />
    case 'default':
      return <DefaultView path={path} />
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(fileViewType: empty) // this breaks when a new file view type is added but not handled here
      return <Text type="BodyError">This shouldn't happen</Text>
  }
}
