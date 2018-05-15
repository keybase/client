// @flow
import * as shared from './icon.shared'
import logger from '../logger'
import React, {Component} from 'react'
import shallowEqual from 'shallowequal'
import {globalColors, glamorous, desktopStyles, collapseStyles} from '../styles'
import {iconMeta} from './icon.constants'
import {resolveImageAsURL} from '../desktop/resolve-root'
import Box from './box'

import type {Props, IconType} from './icon'

const StyledSpan = glamorous.span(props => ({
  color: props.color,
  ...(props.hoverColor
    ? {
        ':hover': {
          color: props.hoverColor,
        },
      }
    : null),
}))

class Icon extends Component<Props, void> {
  shouldComponentUpdate(nextProps: Props, nextState: any): boolean {
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
      logger.warn('Null iconType passed')
      return null
    }

    if (this.props.inheritColor) {
      color = 'inherit'
      hoverColor = 'inherit'
    } else {
      color =
        this.props.color || color || (this.props.opacity ? globalColors.lightGrey : globalColors.black_40)
      hoverColor =
        this.props.hoverColor ||
        hoverColor ||
        (this.props.opacity ? globalColors.black : globalColors.black_75)
    }

    const isFontIcon = iconType.startsWith('iconfont-')
    const fontSizeHint = this.props.fontSize ? {fontSize: this.props.fontSize} : shared.fontSize(iconType)
    const onClick = this.props.onClick
      ? e => {
          e.stopPropagation()
          this.props.onClick && this.props.onClick(e)
        }
      : null

    const hasContainer = (this.props.onClick && this.props.style) || isFontIcon

    const imgStyle = collapseStyles([
      desktopStyles.noSelect,
      !hasContainer ? this.props.style : {},
      onClick ? desktopStyles.clickable : {},
      this.props.color ? {color: color} : {},
    ])

    const iconElement = isFontIcon ? (
      String.fromCharCode(iconMeta[iconType].charCode || 0)
    ) : (
      <img
        className={this.props.className}
        draggable="false"
        title={this.props.hint}
        style={imgStyle}
        onClick={onClick}
        srcSet={iconTypeToSrcSet(iconType)}
      />
    )

    if (hasContainer) {
      const cleanStyle = collapseStyles([
        {
          fontFamily: 'kb',
          speak: 'none',
          fontStyle: 'normal',
          fontWeight: 'normal',
          fontVariant: 'normal',
          textTransform: 'none',
          lineHeight: 1, // NOT 1px, just 1
          WebkitFontSmoothing: 'antialiased',
        },
        this.props.style,
      ])

      return (
        <Box>
          <StyledSpan
            alt={this.props.hint}
            color={color}
            style={{
              ...desktopStyles.noSelect,
              ...styles.icon,
              ...fontSizeHint,
              ...cleanStyle,
              ...(onClick ? desktopStyles.clickable : {}),
            }}
            className={this.props.className || ''}
            onMouseEnter={this.props.onMouseEnter}
            onMouseLeave={this.props.onMouseLeave}
            hoverColor={onClick ? hoverColor : null}
            onClick={onClick}
          >
            {iconElement}
          </StyledSpan>
        </Box>
      )
    } else {
      return iconElement
    }
  }
}

const imgName = (type: IconType, ext: string, mult: number, prefix: ?string, postfix: ?string) =>
  `${prefix || ''}${resolveImageAsURL('icons', type)}${mult > 1 ? `@${mult}x` : ''}.${ext}${postfix ||
    ''} ${mult}x`

function iconTypeToSrcSet(type: IconType) {
  const ext = shared.typeExtension(type)
  return [1, 2].map(mult => imgName(type, ext, mult)).join(', ')
}

export function iconTypeToImgSet(type: IconType) {
  const ext = shared.typeExtension(type)
  const imgs = [1, 2].map(mult => `url${imgName(type, ext, mult, "('", "')")}`).join(', ')
  return `-webkit-image-set(${imgs})`
}

const idealSizeMultMap = {
  '128': {'1': 256, '2': 256, '3': 960},
  '16': {'1': 256, '2': 256, '3': 192},
  '32': {'1': 256, '2': 256, '3': 192},
  '48': {'1': 192, '2': 192, '3': 960},
  '64': {'1': 256, '2': 256, '3': 192},
  '96': {'1': 192, '2': 192, '3': 960},
}

export function urlsToImgSet(imgMap: {[size: string]: string}, targetSize: number): any {
  let sizes: any = Object.keys(imgMap)

  if (!sizes.length) {
    return null
  }

  sizes = sizes.map(s => parseInt(s, 10)).sort((a: number, b: number) => a - b)

  const multsMap: any = {
    '1': null,
    '2': null,
    '3': null,
  }

  Object.keys(multsMap).forEach(mult => {
    // find ideal size if it exist
    const level1 = idealSizeMultMap[String(targetSize)]
    if (level1) {
      const level2 = level1[String(mult)]
      if (level2) {
        multsMap[mult] = level2
        return
      }
    }

    // fallback
    const ideal = parseInt(mult, 10) * targetSize
    const size = sizes.find(size => size >= ideal)
    multsMap[mult] = size || sizes[sizes.length - 1]
  })

  const str = Object.keys(multsMap)
    .map(mult => `url(${imgMap[multsMap[mult]]}) ${mult}x`)
    .join(', ')
  return `-webkit-image-set(${str})`
}

export const styles = {
  icon: {
    fontSize: 16,
  },
}

export default Icon
