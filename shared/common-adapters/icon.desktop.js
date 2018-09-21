// @flow
import * as Shared from './icon.shared'
import logger from '../logger'
import React, {Component} from 'react'
import shallowEqual from 'shallowequal'
import {globalColors, desktopStyles, collapseStyles} from '../styles'
import {iconMeta} from './icon.constants'
import {resolveImageAsURL} from '../desktop/app/resolve-root.desktop'
import type {Props, IconType} from './icon'
import {invert} from 'lodash-es'

const invertedColors = invert(globalColors)

// const StyledSpan = styled('span')(props => ({
// color: props.color,
// ...(props.hoverColor
// ? {
// ':hover': {
// color: props.hoverColor,
// },
// }
// : null),
// }))

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
    let color = Shared.defaultColor(this.props.type)
    let hoverColor = Shared.defaultHoverColor(this.props.type)
    let iconType = Shared.typeToIconMapper(this.props.type)

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
    const fontSizeHint = this.props.fontSize ? {fontSize: this.props.fontSize} : Shared.fontSize(iconType)
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
          WebkitFontSmoothing: 'antialiased',
          fontFamily: 'kb',
          fontStyle: 'normal',
          fontVariant: 'normal',
          fontWeight: 'normal',
          lineHeight: 1,
          speak: 'none',
          textTransform: 'none',
        },
        this.props.style,
      ])

      let colorStyleName
      let hoverStyleName
      let inheritStyle

      // TODO get rid of this concept
      if (this.props.inheritColor) {
        inheritStyle = {
          color: 'inherit',
          hoverColor: 'inherit',
        }
      } else {
        const hoverColorName = this.props.onClick ? invertedColors[hoverColor] : null
        hoverStyleName = hoverColorName ? `hover_color_${hoverColorName}` : ''
        const colorName = invertedColors[color]
        if (!colorName) {
          throw new Error('Invalid color for icon, needs to be in stylesheet')
        }
        colorStyleName = `color_${colorName}`
      }

      return (
        <div style={this.props.boxStyle}>
          <span
            alt={this.props.hint}
            style={{
              ...desktopStyles.noSelect,
              ...styles.icon,
              ...fontSizeHint,
              ...(onClick ? desktopStyles.clickable : {}),
              ...cleanStyle,
              ...inheritStyle,
            }}
            className={[colorStyleName, hoverStyleName, this.props.className].filter(Boolean).join(' ')}
            onMouseEnter={this.props.onMouseEnter}
            onMouseLeave={this.props.onMouseLeave}
            onClick={onClick}
          >
            {iconElement}
          </span>
        </div>
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
  const ext = Shared.typeExtension(type)
  return [1, 2].map(mult => imgName(type, ext, mult)).join(', ')
}

export function iconTypeToImgSet(imgMap: {[size: string]: string}, targetSize: number): any {
  const multsMap = Shared.getMultsMap(imgMap, targetSize)
  const sets = Object.keys(multsMap)
    .map(mult => {
      const img = imgMap[multsMap[mult]]
      if (!img) return null
      const url = resolveImageAsURL('icons', img)
      return `url('${url}.png') ${mult}x`
    })
    .filter(Boolean)
    .join(', ')
  return sets ? `-webkit-image-set(${sets})` : null
}

export function urlsToImgSet(imgMap: {[size: string]: string}, targetSize: number): any {
  const multsMap = Shared.getMultsMap(imgMap, targetSize)
  const sets = Object.keys(multsMap)
    .map(mult => {
      const url = imgMap[multsMap[mult]]
      if (!url) {
        return null
      }
      return `url(${url}) ${mult}x`
    })
    .filter(Boolean)
    .join(', ')
  return sets ? `-webkit-image-set(${sets})` : null
}

export const styles = {
  icon: {
    fontSize: 16,
  },
}

export function castPlatformStyles(styles: any) {
  return Shared.castPlatformStyles(styles)
}

export default Icon
