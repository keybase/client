import * as Shared from './icon.shared'
import * as Styles from '../styles'
import logger from '../logger'
import React, {Component} from 'react'
import shallowEqual from 'shallowequal'
import {iconMeta} from './icon.constants'
import {resolveImageAsURL} from '../desktop/app/resolve-root.desktop'
import {invert} from 'lodash-es'
import {Props, IconType} from './icon'

const invertedColors = invert(Styles.globalColors)

class Icon extends Component<Props, void> {
  static defaultProps = {
    sizeType: 'Default',
  }
  shouldComponentUpdate(nextProps: Props): boolean {
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

    if (!Shared.isValidIconType(iconType)) {
      logger.warn('Unknown icontype passed', iconType)
      throw new Error('Unknown icontype passed ' + iconType)
    }

    if (this.props.inheritColor) {
      color = 'inherit'
      hoverColor = 'inherit'
    } else {
      color =
        this.props.color ||
        color ||
        (this.props.opacity ? Styles.globalColors.greyLight : Styles.globalColors.black_50)
      hoverColor =
        this.props.hoverColor ||
        hoverColor ||
        (this.props.opacity ? Styles.globalColors.black : Styles.globalColors.black)
    }

    const isFontIcon = iconMeta[iconType].isFont
    let fontSizeHint
    // explicit
    if (this.props.fontSize) {
      fontSizeHint = {fontSize: this.props.fontSize}
    } else if (this.props.sizeType) {
      fontSizeHint = {fontSize: Shared.typeToFontSize(this.props.sizeType)}
    }
    // in style sheet, so don't apply
    if (fontSizeHint && fontSizeHint.fontSize === 16) {
      fontSizeHint = null
    }
    const onClick = this.props.onClick
      ? e => {
          e.stopPropagation()
          this.props.onClick && this.props.onClick(e)
        }
      : null

    const hasContainer = !this.props.noContainer && ((this.props.onClick && this.props.style) || isFontIcon)

    let iconElement

    if (isFontIcon) {
      // handled by a class below
      iconElement = null
    } else {
      const imgStyle = Styles.collapseStyles([
        Styles.desktopStyles.noSelect,
        !hasContainer ? this.props.style : {},
        onClick ? Styles.desktopStyles.clickable : {},
        this.props.color ? {color: color} : {},
      ])

      iconElement = (
        <img
          className={this.props.className}
          draggable={false}
          title={this.props.hint}
          style={imgStyle}
          onClick={onClick || undefined}
          srcSet={iconTypeToSrcSet(iconType)}
        />
      )
    }

    if (hasContainer) {
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
        colorStyleName = `color_${colorName}`
      }

      const style = Styles.collapseStyles([
        fontSizeHint,
        onClick && Styles.desktopStyles.clickable,
        inheritStyle,
        this.props.colorOverride && {color: this.props.colorOverride},
        this.props.style,
      ])

      return (
        <div
          style={Styles.collapseStyles([
            // This breaks a couple existing uses. So only apply it when padding
            // is provided for now. Eventually after we know all uses are fine,
            // we can remove the padding guard.
            this.props.padding && styles.flex,
            this.props.boxStyle,
          ])}
        >
          <span
            style={Styles.collapseStyles([
              style,
              this.props.padding && Shared.paddingStyles[this.props.padding],
            ])}
            className={Styles.classNames(
              'icon',
              colorStyleName,
              hoverStyleName,
              `icon-gen-${iconType}`,
              this.props.className
            )}
            onMouseEnter={this.props.onMouseEnter || undefined}
            onMouseLeave={this.props.onMouseLeave || undefined}
            onClick={onClick || undefined}
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

const imgName = (type: IconType, ext: string, mult: number, prefix?: string, postfix?: string) =>
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

export function castPlatformStyles(styles: any) {
  return Shared.castPlatformStyles(styles)
}

const styles = Styles.styleSheetCreate({
  // Needed because otherwise the containing box doesn't calculate the size of
  // the inner span (incl padding) properly
  flex: {display: 'flex'},
})

export default Icon
