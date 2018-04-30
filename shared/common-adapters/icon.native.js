// @flow
import logger from '../logger'
import * as shared from './icon.shared'
import ClickableBox from './clickable-box'
import * as React from 'react'
import {globalColors, glamorous, collapseStyles} from '../styles'
import {iconMeta} from './icon.constants'
import {NativeStyleSheet} from './native-wrappers.native.js'
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
    const color = props.color || shared.defaultColor(props.type) || (props.opacity && globalColors.lightGrey)
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

    const temp = shared.fontSize(shared.typeToIconMapper(props.type))
    if (temp) {
      return styles[temp.fontSize]
    }
    return null
  },
  props =>
    props.style && props.style.backgroundColor ? {backgroundColor: props.style.backgroundColor} : null
)

const Image = glamorous.image(
  {
    resizeMode: 'contain',
  },
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
    let iconType = shared.typeToIconMapper(props.type)

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
      icon = <Image source={iconMeta[iconType].require} style={iconStyle} />
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

export function iconTypeToImgSet(type: IconType) {
  return iconMeta[type].require
}

export function urlsToImgSet(imgMap: {[size: string]: string}, targetSize: number): any {
  let sizes: any = Object.keys(imgMap)

  if (!sizes.length) {
    return null
  }

  sizes = sizes.map(s => parseInt(s, 10)).sort((a: number, b: number) => a - b)

  // RCTImageView finds a 'fit' ratio of image size to targetSize and finds the largest one that isn't over, which
  // too often chooses a low res image, this uses similar logic to the icon.desktop

  const multsMap: any = {
    '1': null,
    '2': null,
    '3': null,
  }

  Object.keys(multsMap).forEach(mult => {
    const ideal = parseInt(mult, 10) * targetSize
    // Find a larger than ideal size or just the largest possible
    const size = sizes.find(size => size >= ideal)
    multsMap[mult] = size || sizes[sizes.length - 1]
  })

  return Object.keys(multsMap).map(mult => ({
    height: parseInt(mult, 10) * targetSize,
    uri: imgMap[multsMap[mult]],
    width: parseInt(mult, 10) * targetSize,
  }))
}

export default Icon
