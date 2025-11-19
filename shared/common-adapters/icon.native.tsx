import * as React from 'react'
import * as Shared from './icon.shared'
import * as Styles from '@/styles'
import logger from '@/logger'
import type {IconType, Props, SizeType} from './icon'
import {Pressable, Image as RNImage, Text as RNText} from 'react-native'
import {iconMeta} from './icon.constants-gen'
import type {MeasureRef} from './measure-ref'

type TextProps = {
  children: React.ReactNode
  color?: Styles.Color
  fixOverdraw?: boolean
  fontSize?: number
  onClick?: (event: React.BaseSyntheticEvent) => void
  onLongPress?: (event: React.BaseSyntheticEvent) => void
  opacity?: boolean
  sizeType: SizeType
  style?: Props['style']
  type: IconType
}
type Writeable<T> = {-readonly [P in keyof T]: T[P]}
type DirtyType = {
  width?: number
  height?: number
  backgroundColor?: string
  textAlign?: string
  color?: string
}

const Text = React.forwardRef<RNText, TextProps>(function Text(p, ref) {
  const style: Writeable<Styles.StylesCrossPlatform> = {}

  // we really should disallow reaching into style like this but this is what the old code does.
  const pStyle = p.style as DirtyType | undefined

  const color =
    p.color ||
    pStyle?.color ||
    Shared.defaultColor(p.type) ||
    (p.opacity ? Styles.globalColors.greyLight : undefined)
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

  if (p.fontSize !== undefined || pStyle?.width !== undefined) {
    style.fontSize = p.fontSize || pStyle?.width
  }

  const temp = Shared.fontSize(p.type)
  if (temp) {
    style.fontSize = temp.fontSize
  }

  // explicit
  const fontSizeStyle = {fontSize: p.fontSize || Shared.typeToFontSize(p.sizeType)}

  return (
    <RNText
      style={[styles.text, style, p.fixOverdraw && styles.fixOverdraw, fontSizeStyle, p.style]}
      allowFontScaling={false}
      ref={ref}
      onPress={p.onClick || undefined}
      onLongPress={p.onLongPress}
      suppressHighlighting={true}
    >
      {p.children}
    </RNText>
  )
})
Text.displayName = 'IconText'

type ImageProps = {
  style?: Props['style']
  source?: number
}

const Image = React.forwardRef<RNImage, ImageProps>((p, ref) => {
  if (!p.source) return null

  let style: Styles.StylesCrossPlatform | undefined

  // we really should disallow reaching into style like this but this is what the old code does.
  // TODO change this
  const pStyle = p.style as DirtyType | undefined

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

  return <RNImage ref={ref} style={[style, pStyle]} source={p.source} />
})
Image.displayName = 'IconImage'

// This ref isn't correct but i'm not sure what would break if its changed now, TODO
const Icon = React.memo<Props>(
  React.forwardRef<MeasureRef, Props>((p, ref) => {
    const sizeType = p.sizeType || 'Default'
    // Only apply props.style to icon if there is no onClick
    const hasContainer = p.onClick && p.style
    const iconType = p.type
    const isDarkMode = React.useContext(Styles.DarkModeContext)

    React.useImperativeHandle(ref, () => {
      return {
        divRef: {current: null},
      }
    }, [])

    if (!Shared.isValidIconType(iconType)) {
      logger.warn(`Invalid icon type passed in: ${String(iconType)}`)
      return null
    }

    const wrap = !p.noContainer && p.onClick
    let icon: React.ReactNode

    if (iconMeta[iconType].isFont) {
      const code = String.fromCharCode(iconMeta[iconType].charCode || 0)
      let color: undefined | string
      if (p.colorOverride || p.color) {
        color = p.colorOverride || p.color
      }

      icon = (
        <Text
          fixOverdraw={p.fixOverdraw}
          style={hasContainer ? null : p.style}
          color={color}
          type={p.type}
          fontSize={p.fontSize}
          sizeType={sizeType}
          onClick={wrap ? undefined : p.onClick}
          onLongPress={p.onLongPress}
        >
          {code}
        </Text>
      )
    } else {
      let source = (isDarkMode && iconMeta[iconType].requireDark) || iconMeta[iconType].require
      if (typeof source !== 'number') {
        source = undefined
      }
      icon = <Image source={source} style={hasContainer ? null : p.style} />
    }

    return wrap ? (
      <Pressable
        onPress={p.onClick || undefined}
        //activeOpacity={0.8}
        style={Styles.collapseStyles([p.style, p.padding && Shared.paddingStyles[p.padding]])}
      >
        {icon}
      </Pressable>
    ) : (
      icon
    )
  })
)
Icon.displayName = 'Icon'

export function iconTypeToImgSet(imgMap: {[size: string]: IconType}, targetSize: number): unknown {
  const multsMap = Shared.getMultsMap(imgMap, targetSize)
  const idealMults = [2, 3, 1] as const
  for (const mult of idealMults) {
    if (multsMap[mult]) {
      const size = multsMap[mult]
      if (!size) return null
      const icon = imgMap[size]
      if (!icon) return null
      return iconMeta[icon].require
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

export function urlsToImgSet(imgMap: {[size: string]: string}, targetSize: number): unknown {
  const multsMap = Shared.getMultsMap(imgMap, targetSize)
  const keys = Object.keys(multsMap)
  const imgSet = keys
    .map(mult => {
      const size = multsMap[mult as unknown as keyof typeof multsMap]
      const uri = size ? imgMap[size] : null
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

// Desktop-only functions - not used on native but needed for import compatibility
export function urlsToSrcSet(_imgMap: {[key: number]: string}, _targetSize: number): null {
  return null
}

export function urlsToBaseSrc(_imgMap: {[key: number]: string}, _targetSize: number): null {
  return null
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
