// @flow
import * as shared from './icon.shared'
import ClickableBox from './clickable-box'
import React from 'react'
import {NativeText, NativeImage} from './native-wrappers.native'
import {globalColors} from '../styles'
import {iconMeta} from './icon.constants'
import {omit} from 'lodash'

import type {Exact} from '../constants/types/more'
import type {IconType, Props} from './icon'

const Icon = (props: Exact<Props>) => {
  let iconType = shared.typeToIconMapper(props.type)

  if (!iconType) {
    console.warn('Null iconType passed')
    return null
  }
  if (!iconMeta[iconType]) {
    console.warn(`Invalid icon type passed in: ${iconType}`)
    return null
  }

  const color =
    (props.style && props.style.color) ||
    shared.defaultColor(props.type) ||
    (props.opacity ? globalColors.lightGrey : globalColors.black_40)
  const styleWidth = props.style && props.style.width
  const width = styleWidth && {width: props.style.width}
  const backgroundColor = (props.style && {
    backgroundColor: props.style.backgroundColor,
  }) || {}

  let icon

  if (iconMeta[iconType].isFont) {
    const fontSizeHint = shared.fontSize(iconType)
    const fontSize =
      (props.style &&
      (props.style.fontSize || styleWidth) && {
        fontSize: props.style.fontSize || styleWidth,
      }) ||
      fontSizeHint
    const textAlign = props.style && props.style.textAlign
    const code = String.fromCharCode(iconMeta[iconType].charCode || 0)

    icon = (
      <NativeText
        style={{
          color,
          textAlign,
          fontFamily: 'kb',
          ...fontSize,
          ...width,
          ...backgroundColor,
        }}
      >
        {code}
      </NativeText>
    )
  } else {
    const height = props.style &&
    props.style.height && {height: props.style.height}
    icon = (
      <NativeImage
        source={iconMeta[iconType].require}
        style={{resizeMode: 'contain', ...width, ...height, ...backgroundColor}}
      />
    )
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

export function iconTypeToImgSet(type: IconType) {
  return iconMeta[type].require
}

export function urlsToImgSet(
  imgMap: {[size: string]: string},
  size: number
): any {
  return Object.keys(imgMap).map(size => ({
    height: parseInt(size, 10),
    uri: imgMap[size],
    width: parseInt(size, 10),
  }))
}

export default Icon
