// @flow
import * as shared from './icon.shared'
import ClickableBox from './clickable-box'
import React from 'react'
import {globalColors} from '../styles'
import {iconMeta} from './icon.constants'
import omit from 'lodash/omit'
import has from 'lodash/has'
import glamorous from 'glamorous-native'
import {NativeStyleSheet} from './native-wrappers.native.js'

import type {Exact} from '../constants/types/more'
import type {IconType, Props} from './icon'

// In order to optimize this commonly used component we use StyleSheet on all the default variants
// so we can pass IDs around instead of full objects
const fontSizes = Object.keys(iconMeta).reduce((map: any, type: IconType) => {
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
  // static styles
  {
    color: globalColors.black_40,
    fontFamily: 'kb',
  },
  // dynamic styles. check for undefined and send null
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
    if (
      (props.style && props.style.fontSize !== undefined) ||
      (props.style && props.style.width !== undefined)
    ) {
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

const Image = glamorous.image(
  {
    resizeMode: 'contain',
  },
  props =>
    props.style && props.style.width !== undefined
      ? {
          width: props.style.width,
        }
      : null,
  props =>
    props.style && props.style.height !== undefined
      ? {
          height: props.style.height,
        }
      : null,
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
    // We can't pass color to Image, but often we generically pass color to Icon, so instead of leaking this out
    // lets just filter it out if it exists
    const imageStyle = has(props.style, 'color') ? omit(props.style, 'color') : props.style
    icon = <Image source={iconMeta[iconType].require} style={imageStyle} />
  }

  const filter = ['color', 'fontSize', 'textAlign']
  const boxStyle = filter.some(key => has(props.style, key)) ? omit(props.style, filter) : props.style

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
