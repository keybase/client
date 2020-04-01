import * as Shared from './icon.shared'
import * as Styles from '../styles'
import * as React from 'react'
import logger from '../logger'
import {iconMeta} from './icon.constants-gen'
import {resolveImageAsURL} from '../desktop/app/resolve-root.desktop'
import invert from 'lodash/invert'
import {Props, IconType} from './icon'

class Icon extends React.PureComponent<Props, void> {
  static defaultProps = {
    sizeType: 'Default',
  }

  render() {
    let color = Shared.defaultColor(this.props.type)
    let hoverColor = Shared.defaultHoverColor(this.props.type)
    const iconType = Shared.typeToIconMapper(this.props.type)

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
    let fontSizeHint: undefined | {fontSize: number}
    // explicit
    if (this.props.fontSize) {
      fontSizeHint = {fontSize: this.props.fontSize}
    } else if (this.props.sizeType) {
      fontSizeHint = {fontSize: Shared.typeToFontSize(this.props.sizeType)}
    }
    // in style sheet, so don't apply
    if (fontSizeHint && fontSizeHint.fontSize === 16) {
      fontSizeHint = undefined
    }
    const onClick = this.props.onClick
      ? (e: React.BaseSyntheticEvent) => {
          e.stopPropagation()
          this.props.onClick && this.props.onClick(e)
        }
      : null

    const hasContainer = !this.props.noContainer && ((this.props.onClick && this.props.style) || isFontIcon)

    let iconElement: React.ReactNode = null

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
      let colorStyleName: undefined | string // Populated if using CSS
      let hoverStyleName: undefined | string
      let inheritStyle: undefined | {color: string; hoverColor: string}

      // TODO get rid of this concept
      if (this.props.inheritColor) {
        inheritStyle = {
          color: 'inherit',
          hoverColor: 'inherit',
        }
      } else {
        // invert the colors here so it reflects the colors in current theme
        const invertedColors = invert(Styles.globalColors)
        const hoverColorName = this.props.onClick ? invertedColors[hoverColor] : null
        hoverStyleName = hoverColorName ? `hover_color_${hoverColorName}` : ''
        const colorName = invertedColors[color]
        if (colorName) {
          colorStyleName = `color_${colorName}`
        }
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
              typeof colorStyleName !== 'string' ? {color} : null, // For colors that are not in Styles.globalColors
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

const imgName = (
  name: string,
  ext: string,
  imagesDir: string,
  mult: number,
  prefix?: string,
  postfix?: string
) =>
  `${prefix || ''}${resolveImageAsURL(imagesDir, name)}${mult > 1 ? `@${mult}x` : ''}.${ext}${postfix ||
    ''} ${mult}x`

function iconTypeToSrcSet(type: IconType) {
  const ext = Shared.typeExtension(type)
  const name: string = (Styles.isDarkMode() && iconMeta[type].nameDark) || type
  const imagesDir = Shared.getImagesDir(type)
  return [1, 2, 3].map(mult => imgName(name, ext, imagesDir, mult)).join(', ')
}

export function iconTypeToImgSet(imgMap: any, targetSize: number): any {
  const multsMap: any = Shared.getMultsMap(imgMap, targetSize)
  const sets = Object.keys(multsMap)
    .map(mult => {
      const img: string = imgMap[multsMap[mult]] as string
      if (!img) return null
      const url = resolveImageAsURL('icons', img)
      if (Styles.isDarkMode()) url.replace('icon-', 'icon-dark-')
      return `url('${url}.png') ${mult}x`
    })
    .filter(Boolean)
    .join(', ')
  return sets ? `-webkit-image-set(${sets})` : null
}

export function urlsToImgSet(imgMap: any, targetSize: number): any {
  const multsMap: any = Shared.getMultsMap(imgMap, targetSize)
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

const styles = Styles.styleSheetCreate(() => ({
  // Needed because otherwise the containing box doesn't calculate the size of
  // the inner span (incl padding) properly
  flex: {display: 'flex'},
}))

export default Icon
