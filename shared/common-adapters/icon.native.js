// @flow
import logger from '../logger'
import * as Shared from './icon.shared'
import ClickableBox from './clickable-box'
import * as React from 'react'
import {NativeImage} from './native-image.native'
import {globalColors, glamorous, collapseStyles} from '../styles'
import {iconMeta} from './icon.constants'
import {NativeStyleSheet} from './native-wrappers.native'
import type {IconType, Props} from './icon'

// In order to optimize this commonly used component we use StyleSheet on all the default variants
// so we can pass IDs around instead of full objects
// $FlowIssue
const fontSizes = Object.keys(iconMeta).reduce((map: any, type: IconType) => {
  const meta = iconMeta[type]
  if (meta.gridSize) {
    map[meta.gridSize] = {
      fontSize: meta.gridSize,
    }
  }
  return map
}, {})

const styles = NativeStyleSheet.create(fontSizes)

const Text = glamorous.text(
  // static styles
  {
    color: globalColors.black_40,
    fontFamily: 'kb',
  },
  // dynamic styles. check for undefined and send null
  props =>
    props.style && props.style.width !== undefined
      ? {
          width: props.style.width,
        }
      : null,
  props => {
    const color = props.color || Shared.defaultColor(props.type) || (props.opacity && globalColors.lightGrey)
    if (color) {
      return {color}
    } else return null
  },
  props =>
    props.textAlign !== undefined
      ? {
          textAlign: props.textAlign,
        }
      : null,
  props => {
    if (props.fontSize !== undefined || (props.style && props.style.width !== undefined)) {
      return {fontSize: props.fontSize || props.style.width}
    }

    const temp = Shared.fontSize(Shared.typeToIconMapper(props.type))
    if (temp) {
      return styles[temp.fontSize]
    }
    return null
  },
  props =>
    props.style && props.style.backgroundColor ? {backgroundColor: props.style.backgroundColor} : null
)

const Image = glamorous(NativeImage)(
  props =>
    props.style && props.style.width !== undefined
      ? {
          width: props.style.width,
        }
      : null,
  props =>
    props.style && props.style.height !== undefined
      ? {
          height: props.style.height,
        }
      : null,
  props =>
    props.style && props.style.backgroundColor ? {backgroundColor: props.style.backgroundColor} : null
)

class Icon extends React.PureComponent<Props> {
  render() {
    const props = this.props
    // Only apply props.style to icon if there is no onClick
    const hasContainer = props.onClick && props.style
    let iconStyle = hasContainer ? null : props.style
    let iconType = Shared.typeToIconMapper(props.type)

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
      if (props.color) {
        iconStyle = collapseStyles([iconStyle, {color: props.color}])
      }
      icon = (
        <Text style={iconStyle} type={props.type} fontSize={props.fontSize}>
          {code}
        </Text>
      )
    } else {
      icon = <Image source={iconMeta[iconType].require} style={iconStyle} resizeMode="contain" />
    }

    return props.onClick ? (
      <ClickableBox
        activeOpacity={0.8}
        underlayColor={props.underlayColor || globalColors.white}
        onClick={props.onClick}
        style={props.style}
      >
        {icon}
      </ClickableBox>
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

export default Icon
