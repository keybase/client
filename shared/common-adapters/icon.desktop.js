// @flow
import * as shared from './icon.shared'
import React, {Component} from 'react'
import shallowEqual from 'shallowequal'
import FontIcon from 'material-ui/FontIcon'
import {globalStyles, globalColors} from '../styles'
import {iconMeta} from './icon.constants'
import {resolveImageAsURL} from '../desktop/resolve-root'

import type {Exact} from '../constants/types/more'
import type {Props, IconType} from './icon'

class Icon extends Component<void, Exact<Props>, void> {
  shouldComponentUpdate(nextProps: Exact<Props>, nextState: any): boolean {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (key === 'style') {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  render() {
    let color = shared.defaultColor(this.props.type)
    let hoverColor = shared.defaultHoverColor(this.props.type)
    let iconType = shared.typeToIconMapper(this.props.type)

    if (!iconType) {
      console.warn('Null iconType passed')
      return null
    }

    if (this.props.inheritColor) {
      color = 'inherit'
      hoverColor = 'inherit'
    } else {
      color =
        (this.props.style && this.props.style.color) ||
        color ||
        (this.props.opacity ? globalColors.lightGrey : globalColors.black_40)
      hoverColor =
        (this.props.style && this.props.style.hoverColor) ||
        hoverColor ||
        (this.props.opacity ? globalColors.black : globalColors.black_75)
    }

    const isFontIcon = iconType.startsWith('iconfont-')
    const fontSizeHint = shared.fontSize(iconType)
    const onClick =
      !!this.props.onClick &&
      (e => {
        e.stopPropagation()
        this.props.onClick && this.props.onClick(e)
      })

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
        ...this.props.style,
      }
      // We have to blow these styles away else FontIcon gets confused and will overwrite what it calculates
      delete cleanStyle.color
      delete cleanStyle.hoverColor

      return (
        <FontIcon
          title={this.props.hint}
          style={{
            ...globalStyles.noSelect,
            ...styles.icon,
            ...fontSizeHint,
            ...cleanStyle,
            ...(onClick ? globalStyles.clickable : {}),
          }}
          className={this.props.className || ''}
          color={color}
          hoverColor={onClick ? hoverColor : null}
          onMouseEnter={this.props.onMouseEnter}
          onMouseLeave={this.props.onMouseLeave}
          onClick={onClick}
        >
          {String.fromCharCode(iconMeta[iconType].charCode || 0)}
        </FontIcon>
      )
    } else {
      return (
        <img
          className={this.props.className}
          title={this.props.hint}
          style={{
            ...globalStyles.noSelect,
            ...this.props.style,
            ...(onClick ? globalStyles.clickable : {}),
          }}
          onClick={onClick}
          srcSet={iconTypeToSrcSet(iconType)}
        />
      )
    }
  }
}

const imgName = (type: IconType, ext: string, mult: number, prefix: ?string, postfix: ?string) =>
  `${prefix || ''}${resolveImageAsURL('icons', type)}${mult > 1 ? `@${mult}x` : ''}.${ext}${postfix || ''} ${mult}x`

function iconTypeToSrcSet(type: IconType) {
  const ext = shared.typeExtension(type)
  return [1, 2].map(mult => imgName(type, ext, mult)).join(', ')
}

export function iconTypeToImgSet(type: IconType) {
  const ext = shared.typeExtension(type)
  const imgs = [1, 2].map(mult => `url${imgName(type, ext, mult, "('", "')")}`).join(', ')
  return `-webkit-image-set(${imgs})`
}

export function urlsToImgSet(imgMap: {[size: string]: string}, targetSize: number): any {
  const sizes = Object.keys(imgMap)

  if (!sizes.length) {
    return null
  }

  const str = sizes.map(size => `url('${imgMap[size]}') ${parseInt(size, 10) / targetSize}x`).join(', ')
  return `-webkit-image-set(${str})`
}

export const styles = {
  icon: {
    fontSize: 16,
  },
}

export default Icon
