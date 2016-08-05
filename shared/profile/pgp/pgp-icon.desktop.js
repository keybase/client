/* @flow */

import React from 'react'
import {omit} from 'lodash'
import {Box, Icon} from '../../common-adapters'
import {globalColors} from '../../styles/style-guide'
import type {IconType} from '../../common-adapters/icon'
import type {Props, Overlays} from './pgp-icon'

type OverlayProps = {
  style: {
    fontSize: number,
    color: string,
    bottom: number,
    right: number,
  },
  type: IconType,
}

const supportedOverlays: {[key: Overlays]: OverlayProps} = {
  'good': {
    style: {
      fontSize: 24,
      color: globalColors.green,
      bottom: -2,
      right: 5,
    },
    type: 'iconfont-proof-good',
  },
  'placeholder': {
    style: {
      fontSize: 24,
      color: globalColors.grey,
      bottom: -2,
      right: 5,
    },
    type: 'iconfont-proof-placeholder',
  },
  'import': {
    style: {
      fontSize: 16,
      color: globalColors.green,
      bottom: -1,
      right: 11,
    },
    type: 'iconfont-import',
  },
  'generate': {
    style: {
      fontSize: 16,
      color: globalColors.blue,
      bottom: -1,
      right: 11,
    },
    type: 'iconfont-add',
  },
}

const PgpIcon = ({type}: Props) => {
  const overlayProps = supportedOverlays[type]
  return (
    <Box style={{display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', height: 48, width: 48}}>
      <Icon type='iconfont-identity-pgp' style={{fontSize: 40, color: globalColors.black_75}} />
      <Icon {...omit(overlayProps, 'style')} style={{position: 'absolute', bottom: 0, right: 0, ...overlayProps.style}} />
    </Box>
  )
}

export default PgpIcon
