import * as React from 'react'
import {IconType} from '../../common-adapters'

export type Props = {
  label: string
  icon: IconType
  color: string
  onClick: () => void
  onPress?: void
  style?: Object
}

export declare class LinkWithIcon extends React.Component<Props> {}
