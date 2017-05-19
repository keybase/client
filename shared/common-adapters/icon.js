// @flow
import ClickableBox from './clickable-box'
import React from 'react'
import {Image, Font} from './icon-native'
import {globalColors} from '../styles'
import {iconMeta} from './icon.constants'
import {omit} from 'lodash'

import type {Props, IconType} from './icon'

function _fontSize(type: IconType): ?Object {
  const fontSize: ?number = iconMeta[type].gridSize

  if (fontSize) {
    return {fontSize}
  } else {
    return null
  }
}

const Icon = (props: Props) => {
  let iconType = typeToIconMapper(props.type)

  if (!iconType) {
    console.warn('Null iconType passed')
    return null
  }
  if (!iconMeta[iconType]) {
    console.warn(`Invalid icon type passed in: ${iconType}`)
    return null
  }

  const color = (props.style && props.style.color) || defaultColor(props.type) || globalColors.black_40
  const styleWidth = props.style && props.style.width
  const width = styleWidth && {width: styleWidth}
  const backgroundColor = (props.style && {backgroundColor: props.style.backgroundColor}) || {}

  let icon

  if (iconMeta[iconType].isFont) {
    const fontSizeHint = _fontSize(iconType)
    const fontSize =
      (props.style &&
      (props.style.fontSize || styleWidth) && {fontSize: props.style.fontSize || styleWidth}) ||
      fontSizeHint
    const textAlign = props.style && props.style.textAlign
    const code = String.fromCharCode(iconMeta[iconType].charCode || 0)

    icon = (
      <Font
        hasOnClick={!!props.onClick}
        inheritColor={props.inheritColor}
        style={{color, fontFamily: 'kb', textAlign, ...fontSize, ...width, ...backgroundColor}}
        type={props.type}
      >
        {code}
      </Font>
    )
  } else {
    icon = <Image type={iconType} style={props.style} />
  }

  const boxStyle = omit(props.style || {}, ['color', 'fontSize', 'textAlign'])
  return (
    <ClickableBox
      activeOpacity={0.8}
      underlayColor={props.underlayColor || globalColors.white}
      onClick={props.onClick}
      style={boxStyle}
    >
      {icon}
    </ClickableBox>
  )
}

function defaultColor(type: IconType): ?string {
  switch (type) {
    case 'iconfont-proof-broken':
      return globalColors.red
    case 'iconfont-proof-followed':
      return globalColors.green
    case 'iconfont-proof-new':
      return globalColors.blue2
    case 'iconfont-proof-pending':
      return globalColors.black_40
    case 'iconfont-close':
      return globalColors.black_20
    default:
      return null
  }
}

// Some types are the same underlying icon.
function typeToIconMapper(type: IconType): IconType {
  switch (type) {
    case 'icon-progress-white-animated':
      return __SCREENSHOT__ ? 'icon-progress-white-static' : 'icon-progress-white-animated'
    case 'icon-progress-grey-animated':
      return __SCREENSHOT__ ? 'icon-progress-grey-static' : 'icon-progress-grey-animated'
    case 'icon-loader-infinity-64':
      return __SCREENSHOT__ ? 'icon-loader-infinity-static-64' : 'icon-loader-infinity-64'
    case 'icon-loader-infinity-80':
      return __SCREENSHOT__ ? 'icon-loader-infinity-static-80' : 'icon-loader-infinity-80'
    case 'icon-facebook-visibility':
      return __SCREENSHOT__ ? 'icon-facebook-visibility-static' : 'icon-facebook-visibility'
    case 'icon-secure-266':
      return __SCREENSHOT__ ? 'icon-secure-static-266' : 'icon-secure-266'
    case 'icon-securing-266':
      return __SCREENSHOT__ ? 'icon-securing-static-266' : 'icon-securing-266'
    case 'icon-connecting-266':
      return __SCREENSHOT__ ? 'icon-loader-connecting-266-static' : 'icon-loader-connecting-266'
    case 'icon-loader-uploading-16':
      return __SCREENSHOT__ ? 'icon-loader-uploading-16-static' : 'icon-loader-uploading-16'
    default:
      return type
  }
}

export default Icon

export {defaultColor}
