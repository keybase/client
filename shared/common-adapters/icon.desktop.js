// @flow
import * as shared from './icon.shared'
import React, {PureComponent} from 'react'
import {FontIcon} from 'material-ui'
import {globalStyles, globalColors} from '../styles'
import {iconMeta} from './icon.constants'
import {resolveImageAsURL} from '../../desktop/resolve-root'

import type {Exact} from '../constants/types/more'
import type {Props} from './icon'

const Icon = (props: Exact<Props>) => {
  let color = shared.defaultColor(props.type)
  let hoverColor = shared.defaultHoverColor(props.type)
  let iconType = shared.typeToIconMapper(props.type)

  if (!iconType) {
    console.warn('Null iconType passed')
    return null
  }

  if (props.inheritColor) {
    color = 'inherit'
    hoverColor = 'inherit'
  } else {
    color = props.style && props.style.color || color || (props.opacity ? globalColors.lightGrey : globalColors.black_40)
    hoverColor = props.style && props.style.hoverColor || hoverColor || (props.opacity ? globalColors.black : globalColors.black_75)
  }

  const ext = shared.typeExtension(iconType)
  const isFontIcon = iconType.startsWith('iconfont-')
  const fontSizeHint = shared.fontSize(iconType)

  if (isFontIcon) {
    const cleanStyle = {
      fontFamily: 'kb',
      speak: 'none',
      fontStyle: 'normal',
      fontWeight: 'normal',
      fontVariant: 'normal',
      textTransform: 'none',
      lineHeight: 1,
      WebkitFontSmoothing: 'antialiased',
      ...props.style}
    // We have to blow these styles away else FontIcon gets confused and will overwrite what it calculates
    delete cleanStyle.color
    delete cleanStyle.hoverColor

    return <FontIcon
      title={props.hint}
      style={{...globalStyles.noSelect, ...styles.icon, ...fontSizeHint, ...cleanStyle, ...(props.onClick ? globalStyles.clickable : {})}}
      className={props.className || ''}
      color={color}
      hoverColor={props.onClick ? hoverColor : null}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      onClick={props.onClick}>{String.fromCharCode(iconMeta[iconType].charCode || 0)}</FontIcon>
  } else {
    return <img
      className={props.className}
      title={props.hint}
      style={{...globalStyles.noSelect, ...props.style, ...(props.onClick ? globalStyles.clickable : {})}}
      onClick={props.onClick}
      srcSet={imgPath(iconType, ext)} />
  }
}

const imgName = (type, ext, mult) => `${resolveImageAsURL('icons', type)}${mult > 1 ? `@${mult}x` : ''}.${ext} ${mult}x`
const imgPath = (type, ext) => {
  if (ext === 'gif') {
    return `${resolveImageAsURL('icons', type)}.${ext}`
  } else {
    return [1, 2, 3].map(mult => imgName(type, ext, mult)).join(', ')
  }
}

export const styles = {
  icon: {
    fontSize: 16,
  },
}

export default Icon
