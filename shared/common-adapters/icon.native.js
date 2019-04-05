// @flow
import * as React from 'react'
import * as Shared from './icon.shared'
import * as Styles from '../styles'
import logger from '../logger'
import type {IconType, Props, DisallowedStyles, SizeType} from './icon'
import {NativeImage, NativeText, NativeTouchableOpacity} from './native-wrappers.native'
import {iconMeta} from './icon.constants'

const Kb = {
  NativeImage,
  NativeText,
  NativeTouchableOpacity,
}

type TextProps = {|
  children: React.Node,
  color?: Styles.Color,
  fontSize?: number,
  onClick?: ?(event: SyntheticEvent<Element>) => void,
  opacity?: boolean,
  sizeType: SizeType,
  style?: Styles.StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>,
  type: IconType,
|}

const Text = React.memo<TextProps>(p => {
  const style = {}

  // we really should disallow reaching into style like this but this is what the old code does.
  // TODO change this
  // $FlowIssue
  const pStyle: any = p.style

  const color =
    p.color ||
    // $FlowIssue flow is correct but we do actually pass in this color sometimes. TODO remove this
    (pStyle && p.style.color) ||
    Shared.defaultColor(p.type) ||
    (p.opacity && Styles.globalColors.lightGrey)
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

  // $FlowIssue isn't in the type, but keeping this for now. TODO remove this
  if (p.textAlign !== undefined) {
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
  let fontSize
  if (p.fontSize) {
    fontSize = p.fontSize
  } else {
    fontSize = Shared.typeToFontSize(p.sizeType)
  }

  return (
    <Kb.NativeText
      style={[styles.text, style, p.style]}
      allowFontScaling={false}
      type={p.type}
      fontSize={fontSize}
      onPress={p.onClick}
    >
      {p.children}
    </Kb.NativeText>
  )
})

type ImageProps = {|
  style?: Styles.StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>,
  source: any,
|}

const Image = React.memo<ImageProps>(p => {
  let style

  // we really should disallow reaching into style like this but this is what the old code does.
  // TODO change this
  // $FlowIssue
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

  return <Kb.NativeImage style={[style, pStyle]} source={p.source} resizeMode="contain" />
})

class Icon extends React.PureComponent<Props> {
  static defaultProps = {
    sizeType: 'Default',
  }
  render() {
    const p = this.props
    const sizeType = p.sizeType
    // Only apply props.style to icon if there is no onClick
    const hasContainer = p.onClick && p.style
    let iconType = Shared.typeToIconMapper(p.type)

    if (!iconType) {
      logger.warn('Null iconType passed')
      return null
    }
    if (!iconMeta[iconType]) {
      logger.warn(`Invalid icon type passed in: ${iconType}`)
      return null
    }

    let icon

    if (iconMeta[iconType].isFont) {
      const code = String.fromCharCode(iconMeta[iconType].charCode || 0)
      let color
      if (p.colorOverride || p.color) {
        color = p.colorOverride || p.color
      }

      icon = (
        <Text
          style={hasContainer ? null : p.style}
          color={color}
          type={p.type}
          fontSize={p.fontSize}
          sizeType={sizeType}
          onClick={p.onClick}
        >
          {code}
        </Text>
      )
    } else {
      icon = <Image source={iconMeta[iconType].require} style={hasContainer ? null : p.style} />
    }

    return !p.noContainer && p.onClick ? (
      <Kb.NativeTouchableOpacity
        onPress={p.onClick}
        activeOpacity={0.8}
        underlayColor={p.underlayColor || Styles.globalColors.white}
        style={Styles.collapseStyles([p.style, p.padding && Shared.paddingStyles[p.padding]])}
      >
        {icon}
      </Kb.NativeTouchableOpacity>
    ) : (
      icon
    )
  }
}

export function iconTypeToImgSet(imgMap: {[size: string]: IconType}, targetSize: number): any {
  const multsMap = Shared.getMultsMap(imgMap, targetSize)
  const idealMults = [2, 3, 1]
  for (let mult of idealMults) {
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

const styles = Styles.styleSheetCreate({
  text: {
    color: Styles.globalColors.black_50, // MUST set this or it can be inherited from outside text
    fontFamily: 'kb',
    fontWeight: 'normal', // MUST set this or it can be inherited from outside text
  },
})

export default Icon
