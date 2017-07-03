// @flow
import * as shared from './icon.shared'
import ClickableBox from './clickable-box'
import React from 'react'
import {globalColors} from '../styles'
import {iconMeta} from './icon.constants'
import {omit} from 'lodash'
import glamorous from 'glamorous-native'
import {NativeStyleSheet} from './native-wrappers.native.js'

import type {Exact} from '../constants/types/more'
import type {IconType, Props} from './icon'

const fontSizes = Object.keys(iconMeta).reduce((map, type) => {
  const meta = iconMeta[type]
  if (meta.gridSize) {
    map[meta.gridSize] = {
      fontSize: meta.gridSize,
    }
  }
  return map
}, {})

const styles = NativeStyleSheet.create(fontSizes)

const Text = glamorous.text(
  {
    color: globalColors.black_40,
    fontFamily: 'kb',
  },
  props =>
    props.style && props.style.width !== undefined
      ? {
          width: props.style.width,
        }
      : null,
  props => {
    const color =
      (props.style && props.style.color) ||
      shared.defaultColor(props.type) ||
      (props.opacity && globalColors.lightGrey)
    if (color) {
      return {color}
    } else return null
  },
  props =>
    props.style && props.style.textAlign !== undefined
      ? {
          textAlign: props.style.textAlign,
        }
      : null,
  props => {
    if ((props.style && props.style.fontSize !== undefined) || props.style.width !== undefined) {
      return {fontSize: props.style.fontSize || props.style.width}
    }

    const temp = shared.fontSize(shared.typeToIconMapper(props.type))
    if (temp) {
      return styles[temp.fontSize]
    }
    return null
  },
  props =>
    props.style && props.style.backgroundColor ? {backgroundColor: props.style.backgroundColor} : null
)

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

  let icon

  if (iconMeta[iconType].isFont) {
    const code = String.fromCharCode(iconMeta[iconType].charCode || 0)

    icon = (
      <Text style={props.style} type={props.type}>
        {code}
      </Text>
    )
  } else {
    return null
    // const height = props.style && props.style.height && {height: props.style.height}
    // const Image = glamorous.image({resizeMode: 'contain', ...width, ...height, ...backgroundColor})
    // icon = <Image source={iconMeta[iconType].require} style={props.style} />
  }

  const boxStyle = omit(props.style || {}, ['color', 'fontSize', 'textAlign'])

  return props.onClick
    ? <ClickableBox
        activeOpacity={0.8}
        underlayColor={props.underlayColor || globalColors.white}
        onClick={props.onClick}
        style={boxStyle}
      >
        {icon}
      </ClickableBox>
    : icon
}

export function iconTypeToImgSet(type: IconType) {
  return iconMeta[type].require
}

export function urlsToImgSet(imgMap: {[size: string]: string}, size: number): any {
  return Object.keys(imgMap).map(size => ({
    height: parseInt(size, 10),
    uri: imgMap[size],
    width: parseInt(size, 10),
  }))
}

export default Icon
