// @flow
import * as React from 'react'
import Avatar from './avatar'
import Box from './box'
import Icon from './icon'
import Text from './text'
import {isMobile} from '../styles'

type Size = 'small' | 'medium' | 'large'

const sizeToIconSize: {[key: Size]: number} = {}

export type Props = {
  following?: boolean,
  followsMe?: boolean,
  metaOne?: string | React.Node,
  metaTwo?: string | React.Node,
  onClick?: () => void,
  size?: Size,
  teamname?: string,
  username?: string,
}

export default (props: Props) => {}
