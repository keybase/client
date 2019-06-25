import * as React from 'react'
import {IconType} from '../../common-adapters'
import {AllowedColors} from '../../common-adapters/text'

export type Props = {
  label: string
  icon: IconType
  color: AllowedColors
  onClick: () => void
  onPress?: void
  style?: Object
}

export declare class LinkWithIcon extends React.Component<Props> {}
