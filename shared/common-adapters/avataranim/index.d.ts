import * as React from 'react'
import { AvatarSize } from 'common-adapters/avatar.render'

export type Props = {
  size: AvatarSize
  url: any
}

export default class Avatar extends React.Component<Props> {}
