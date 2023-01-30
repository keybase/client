import * as Shared from './icon.shared'
import * as Styles from '../styles'
import {colors, darkColors} from '../styles/colors'
import * as React from 'react'
import logger from '../logger'
import {iconMeta} from './icon.constants-gen'
import invert from 'lodash/invert'
import type {Props, IconType} from './icon'
import {getAssetPath} from '../constants/platform.desktop'

const invertedLight = invert(colors)
const invertedDark = invert(darkColors)

const Icon = React.memo<Props>(
  // @ts-ignore
  React.forwardRef<HTMLDivElement | HTMLImageElement, Props>(function Icon(props, ref) {
    const {type, inheritColor, opacity, fontSize, noContainer, onMouseEnter, onMouseLeave, style} = props
    const {className, hint, colorOverride, padding, boxStyle} = props
    const iconType = Shared.typeToIconMapper(type)
    if (!iconType) {
      logger.warn('Null iconType passed')
      return null
    }

    if (!Shared.isValidIconType(iconType)) {
      logger.warn('Unknown icontype passed', iconType)
      throw new Error('Unknown icontype passed ' + iconType)
    }

    const sizeType = props.sizeType ?? 'Default'
    const onClick = props.onClick
      ? (e: React.BaseSyntheticEvent) => {
          e.stopPropagation()
          // @ts-ignore
          props.onClick?.(props.onClick.length ? e : undefined) // only pass params to functions that need them, helps with electron bridge
        }
      : undefined

    let color = Shared.defaultColor(type)
    let hoverColor = Shared.defaultHoverColor(type)

    if (inheritColor) {
      color = 'inherit'
      hoverColor = 'inherit'
    } else {
      color = props.color || color || (opacity ? Styles.globalColors.greyLight : Styles.globalColors.black_50)
      hoverColor =
        props.hoverColor || hoverColor || (opacity ? Styles.globalColors.black : Styles.globalColors.black)
    }

    const isFontIcon = iconMeta[iconType].isFont
    let fontSizeHint: undefined | {fontSize: number}
    // explicit
    if (fontSize) {
      fontSizeHint = {fontSize: fontSize}
    } else if (sizeType) {
      fontSizeHint = {fontSize: Shared.typeToFontSize(sizeType)}
    }
    // in style sheet, so don't apply
    if (fontSizeHint && fontSizeHint.fontSize === 16) {
      fontSizeHint = undefined
    }
    const hasContainer = !noContainer && ((onClick && style) || isFontIcon)

    let iconElement: React.ReactNode = null

    if (isFontIcon) {
      // handled by a class below
      iconElement = null
    } else {
      const imgStyle = Styles.collapseStyles([
        Styles.desktopStyles.noSelect,
        !hasContainer ? style : {},
        onClick ? Styles.desktopStyles.clickable : {},
        props.color ? {color: color} : {},
      ] as any)

      iconElement = (
        <img
          className={className}
          draggable={false}
          ref={hasContainer ? undefined : (ref as any)}
          title={hint}
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
      if (props.inheritColor) {
        inheritStyle = {
          color: 'inherit',
          hoverColor: 'inherit',
        }
      } else {
        const invertedColors = Styles.isDarkMode() ? invertedDark : invertedLight
        const hoverColorName = onClick ? invertedColors[hoverColor] : null
        hoverStyleName = hoverColorName ? `hover_color_${hoverColorName}` : ''
        const colorName = invertedColors[color]
        if (colorName) {
          colorStyleName = `color_${colorName}`
        }
      }

      const mergedStyle = Styles.collapseStyles([
        fontSizeHint,
        onClick && (Styles.desktopStyles.clickable as any),
        inheritStyle,
        colorOverride && {color: colorOverride},
        style,
      ])

      return (
        <div
          ref={ref}
          style={Styles.collapseStyles([
            // This breaks a couple existing uses. So only apply it when padding
            // is provided for now. Eventually after we know all uses are fine,
            // we can remove the padding guard.
            padding && styles.flex,
            boxStyle,
          ])}
        >
          <span
            title={hint}
            style={Styles.collapseStyles([
              mergedStyle,
              padding && Shared.paddingStyles[padding],
              typeof colorStyleName !== 'string' ? {color} : null, // For colors that are not in Styles.globalColors
            ])}
            className={Styles.classNames(
              'icon',
              colorStyleName,
              hoverStyleName,
              `icon-gen-${iconType}`,
              className
            )}
            onMouseEnter={onMouseEnter || undefined}
            onMouseLeave={onMouseLeave || undefined}
            onClick={onClick || undefined}
          >
            {iconElement}
          </span>
        </div>
      )
    } else {
      return iconElement
    }
  })
)

const imgName = (
  name: string,
  ext: string,
  imagesDir: string,
  mult: number,
  prefix?: string,
  postfix?: string
) =>
  `${prefix || ''}${getAssetPath('images', imagesDir, name)}${mult > 1 ? `@${mult}x` : ''}.${ext}${
    postfix || ''
  } ${mult}x`

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
      const url = getAssetPath('images', 'icons', img)
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
