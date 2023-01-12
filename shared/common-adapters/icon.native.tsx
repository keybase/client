import * as React from 'react'
import * as Shared from './icon.shared'
import * as Styles from '../styles'
import logger from '../logger'
import type {IconType, Props, SizeType} from './icon'
import {NativeImage, NativeText, NativeTouchableOpacity} from './native-wrappers.native'
import {iconMeta} from './icon.constants-gen'

const Kb = {
  NativeImage,
  NativeText,
  NativeTouchableOpacity,
}

type TextProps = {
  children: React.ReactNode
  color?: Styles.Color
  fixOverdraw?: boolean
  fontSize?: number
  onClick?: ((event: React.BaseSyntheticEvent) => void) | null
  onLongPress?: (event: React.BaseSyntheticEvent) => void
  opacity?: boolean
  sizeType: SizeType
  style?: Props['style']
  type: IconType
}
type Writeable<T> = {-readonly [P in keyof T]: T[P]}
const Text = React.forwardRef<NativeText, TextProps>(function Text(p, ref) {
  const style: Writeable<Styles.StylesCrossPlatform> = {}

  // we really should disallow reaching into style like this but this is what the old code does.
  // TODO change this
  const pStyle: any = p.style

  const color =
    p.color ||
    // @ts-ignore TS is correct but we do actually pass in this color
    // sometimes. TODO remove this
    (pStyle && p.style.color) ||
    Shared.defaultColor(p.type) ||
    (p.opacity && Styles.globalColors.greyLight)
  if (color) {
    style.color = color
  }

  if (pStyle) {
    if (pStyle.width !== undefined) {
      style.width = pStyle.width
    }
    if (pStyle.backgroundColor) {
      style.backgroundColor = pStyle.backgroundColor
    }
  }

  // @ts-ignore isn't in the type, but keeping this for now. TODO remove this
  if (p.textAlign !== undefined) {
    // @ts-ignore see above
    style.textAlign = p.textAlign
  }

  if (p.fontSize !== undefined || (pStyle && pStyle.width !== undefined)) {
    style.fontSize = p.fontSize || pStyle.width
  }

  const temp = Shared.fontSize(Shared.typeToIconMapper(p.type))
  if (temp) {
    style.fontSize = temp.fontSize
  }

  // explicit
  const fontSizeStyle = {fontSize: p.fontSize || Shared.typeToFontSize(p.sizeType)}

  return (
    <Kb.NativeText
      style={[styles.text, style, p.fixOverdraw && styles.fixOverdraw, fontSizeStyle, p.style]}
      allowFontScaling={false}
      ref={ref}
      onPress={p.onClick || undefined}
      onLongPress={p.onLongPress}
      suppressHighlighting={true}
    >
      {p.children}
    </Kb.NativeText>
  )
})
Text.displayName = 'IconText'

type ImageProps = {
  style?: Props['style']
  source: any
}

const Image = React.forwardRef<NativeImage, ImageProps>((p, ref) => {
  let style: any

  // we really should disallow reaching into style like this but this is what the old code does.
  // TODO change this
  const pStyle: any = p.style

  if (pStyle) {
    style = {}
    if (pStyle.width !== undefined) {
      style.width = pStyle.width
    }
    if (pStyle.height !== undefined) {
      style.height = pStyle.height
    }
    if (pStyle.backgroundColor) {
      style.backgroundColor = pStyle.backgroundColor
    }
  }

  return <Kb.NativeImage ref={ref} style={[style, pStyle]} source={p.source} />
})
Image.displayName = 'IconImage'

const Icon = React.memo<Props>(
  // TODO this type is a mess
  // @ts-ignore
  React.forwardRef<any, Props>((p: Props, ref: any) => {
    const sizeType = p.sizeType || 'Default'
    // Only apply props.style to icon if there is no onClick
    const hasContainer = p.onClick && p.style
    const iconType = Shared.typeToIconMapper(p.type)

    const isDarkMode = React.useContext(Styles.DarkModeContext)

    if (!iconType) {
      logger.warn('Null iconType passed')
      return null
    }
    if (!Shared.isValidIconType(iconType)) {
      logger.warn(`Invalid icon type passed in: ${iconType}`)
      return null
    }

    const wrap = !p.noContainer && p.onClick
    let icon: React.ReactNode

    if (iconMeta[iconType].isFont) {
      const code = String.fromCharCode(iconMeta[iconType].charCode || 0)
      let color: undefined | string | null
      if (p.colorOverride || p.color) {
        color = p.colorOverride || p.color
      }

      icon = (
        <Text
          fixOverdraw={p.fixOverdraw}
          style={hasContainer ? null : p.style}
          color={color}
          type={p.type}
          ref={wrap ? undefined : ref}
          fontSize={p.fontSize}
          sizeType={sizeType}
          onClick={p.onClick}
          onLongPress={p.onLongPress}
        >
          {code}
        </Text>
      )
    } else {
      icon = (
        <Image
          source={(isDarkMode && iconMeta[iconType].requireDark) || iconMeta[iconType].require}
          style={hasContainer ? null : p.style}
          ref={wrap ? undefined : ref}
        />
      )
    }

    return wrap ? (
      <Kb.NativeTouchableOpacity
        onPress={p.onClick || undefined}
        activeOpacity={0.8}
        ref={ref}
        style={Styles.collapseStyles([p.style, p.padding && Shared.paddingStyles[p.padding]])}
      >
        {icon}
      </Kb.NativeTouchableOpacity>
    ) : (
      icon
    )
  })
)
Icon.displayName = 'Icon'

export function iconTypeToImgSet(imgMap: {[size: string]: IconType}, targetSize: number): any {
  const multsMap = Shared.getMultsMap(imgMap, targetSize)
  const idealMults = [2, 3, 1]
  for (const mult of idealMults) {
    if (multsMap[mult]) {
      return iconMeta[imgMap[multsMap[mult]]].require
    }
  }
  return null
  // Ideally it'd do this but RN won't let you specify multiple required() sources and give it a multplier, it really
  // wants @2x etc. So instead of this we'll just supply 2x
  // return Object.keys(multsMap).map(mult => ({
  // height: parseInt(mult, 10) * targetSize,
  // uri: iconMeta[imgMap[multsMap[mult]]].require,
  // width: parseInt(mult, 10) * targetSize,
  // }))
}

export function urlsToImgSet(imgMap: {[size: string]: string}, targetSize: number): any {
  const multsMap = Shared.getMultsMap(imgMap, targetSize)
  const imgSet = Object.keys(multsMap)
    .map(mult => {
      const uri = imgMap[multsMap[mult]]
      if (!uri) {
        return null
      }
      return {
        height: parseInt(mult, 10) * targetSize,
        uri,
        width: parseInt(mult, 10) * targetSize,
      }
    })
    .filter(Boolean)
  return imgSet.length ? imgSet : null
}

export function castPlatformStyles(styles: any) {
  return Shared.castPlatformStyles(styles)
}

const styles = Styles.styleSheetCreate(() => ({
  fixOverdraw: {
    backgroundColor: Styles.globalColors.fastBlank,
  },
  text: {
    color: Styles.globalColors.black_50, // MUST set this or it can be inherited from outside text
    fontFamily: 'kb',
    fontWeight: 'normal', // MUST set this or it can be inherited from outside text
  },
}))

export default Icon
