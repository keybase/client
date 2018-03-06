// @flow
import * as React from 'react'
import * as shared from './icon.shared'
import ClickableBox from './clickable-box'
import logger from '../logger'
import {globalColors, styleSheetCreate} from '../styles'
import {iconMeta} from './icon.constants'
import {Image, Text} from 'react-native'

import type {IconType, Props} from './icon'

const details = Object.keys(iconMeta).reduce((map: any, rawType: IconType) => {
  const type = shared.typeToIconMapper(rawType)
  const meta = iconMeta[type]
  map[type] = {
    ...(meta.isFont
      ? {
          color: shared.defaultColor(type) || globalColors.black_40,
          fontFamily: 'kb',
          fontSize: meta.gridSize,
        }
      : {
          resizeMode: 'contain',
        }),
  }
  return map
}, {})

const styles = styleSheetCreate({
  ...details,
})

class Icon extends React.PureComponent<Props> {
  render() {
    const props = this.props
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

      icon = (
        <Text style={[styles[iconType], props.style, props.iconStyle]} type={props.type}>
          {code}
        </Text>
      )
    } else {
      icon = <Image source={iconMeta[iconType].require} style={styles[iconType]} />
    }

    return props.onClick ? (
      <ClickableBox
        activeOpacity={0.8}
        underlayColor={props.underlayColor || globalColors.white}
        onClick={props.onClick}
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
