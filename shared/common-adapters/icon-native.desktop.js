// @flow
import React, {Component} from 'react'
import {iconMeta} from './icon.constants'
import {resolveImageAsURL} from '../desktop/resolve-root'
import {globalStyles, globalColors} from '../styles'

import type {IconType} from './icon'

function defaultHoverColor(type: IconType): ?string {
  switch (type) {
    case 'iconfont-close':
      return globalColors.black_60
    default:
      return null
  }
}

class Font extends Component<void, any, {hovering: boolean}> {
  state = {
    hovering: false,
  }

  _onMouseEnter = () => {
    this.setState({hovering: true})
    this.props.onMouseEnter && this.props.onMouseEnter()
  }

  _onMouseLeave = () => {
    this.setState({hovering: false})
    this.props.onMouseLeave && this.props.onMouseLeave()
  }

  render() {
    let color = this.props.style.color
    if (this.state.hovering) {
      if (this.props.inheritColor) {
        color = 'inherit'
      } else {
        color =
          (this.props.style && this.props.style.hoverColor) ||
          defaultHoverColor(this.props.type) ||
          globalColors.black_75
      }
    }

    return (
      <span
        children={this.props.children}
        title={this.props.hint}
        className={this.props.className}
        onMouseEnter={this.props.hasOnClick ? this._onMouseEnter : undefined}
        onMouseLeave={this.props.hasOnClick ? this._onMouseLeave : undefined}
        style={{
          WebkitFontSmoothing: 'antialiased',
          fontStyle: 'normal',
          fontVariant: 'normal',
          fontWeight: 'normal',
          lineHeight: 1,
          speak: 'none',
          textTransform: 'none',
          ...this.props.style,
          color,
        }}
      />
    )
  }
}

const Image = (props: any) => {
  return (
    <img
      className={props.className}
      onClick={props.onClick}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      srcSet={iconTypeToSrcSet(props.type)}
      style={{
        ...globalStyles.noSelected,
        ...(props.onClick ? globalStyles.clickable : {}),
        ...props.style,
      }}
      title={props.hint}
    />
  )
}

export function typeExtension(type: IconType): string {
  return iconMeta[type].extension || 'png'
}

const imgName = (type: IconType, ext: string, mult: number, prefix: ?string, postfix: ?string) =>
  `${prefix || ''}${resolveImageAsURL('icons', type)}${mult > 1 ? `@${mult}x` : ''}.${ext}${postfix || ''} ${mult}x`

function iconTypeToSrcSet(type: IconType) {
  const ext = typeExtension(type)
  return [1, 2].map(mult => imgName(type, ext, mult)).join(', ')
}

function iconTypeToImgSet(type: IconType) {
  const ext = typeExtension(type)
  const imgs = [1, 2].map(mult => `url${imgName(type, ext, mult, "('", "')")}`).join(', ')
  return `-webkit-image-set(${imgs})`
}

function urlsToImgSet(imgMap: {[size: string]: string}, targetSize: number): any {
  const sizes = Object.keys(imgMap)

  if (!sizes.length) {
    return null
  }

  const str = sizes.map(size => `url('${imgMap[size]}') ${parseInt(size, 10) / targetSize}x`).join(', ')
  return `-webkit-image-set(${str})`
}

export {Font, Image, iconTypeToImgSet, urlsToImgSet}
