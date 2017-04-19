// @flow
import * as shared from './icon.shared'
import Box from './box'
import ClickableBox from './clickable-box'
import React, {Component} from 'react'
import {NativeText, NativeImage} from './native-wrappers.native'
import {globalColors} from '../styles'
import {iconMeta} from './icon.constants'

import type {Exact} from '../constants/types/more'
import type {IconType, Props} from './icon'

class Icon extends Component<void, Exact<Props>, void> {
  render () {
    let color = shared.defaultColor(this.props.type)
    let iconType = shared.typeToIconMapper(this.props.type)

    if (!iconType) {
      console.warn('Null iconType passed')
      return null
    }

    color = this.props.style && this.props.style.color || color || (this.props.opacity ? globalColors.lightGrey : globalColors.black_40)

    const styleWidth = this.props.style && this.props.style.width

    const width = styleWidth && {width: this.props.style.width}
    const height = this.props.style && this.props.style.height && {height: this.props.style.height}

    const fontSizeHint = shared.fontSize(iconType)
    const fontSize = (this.props.style && (this.props.style.fontSize || styleWidth) && {fontSize: this.props.style.fontSize || styleWidth}) || fontSizeHint
    const textAlign = this.props.style && this.props.style.textAlign
    const backgroundColor = this.props.style && {backgroundColor: this.props.style.backgroundColor} || {}

    // Extract style props for our container and box
    let containerProps = {
      ...this.props.style,
      bottom: undefined,
      color: undefined,
      fontSize: undefined,
      height: undefined,
      left: undefined,
      position: undefined,
      right: undefined,
      textAlign: undefined,
      top: undefined,
      width: undefined,
    }

    const clickableBoxStyle = {
      bottom: this.props.style && this.props.style.bottom,
      height: this.props.style && this.props.style.height,
      left: this.props.style && this.props.style.left,
      position: this.props.style && this.props.style.position,
      right: this.props.style && this.props.style.right,
      top: this.props.style && this.props.style.top,
      width: this.props.style && this.props.style.width,
    }

    if (!iconMeta[iconType]) {
      console.warn(`Invalid icon type passed in: ${iconType}`)
      return null
    }

    const icon = iconMeta[iconType].isFont
      ? <NativeText style={{color, textAlign, fontFamily: 'kb', ...fontSize, ...width, ...backgroundColor}}>{
        String.fromCharCode(iconMeta[iconType].charCode || 0)}</NativeText>
      : <NativeImage source={iconMeta[iconType].require} style={{resizeMode: 'contain', ...width, ...height, ...backgroundColor}} />

    return (
      <ClickableBox
        activeOpacity={0.8}
        underlayColor={this.props.underlayColor || globalColors.white}
        onClick={this.props.onClick}
        style={clickableBoxStyle}>
        <Box style={containerProps}>
          {icon}
        </Box>
      </ClickableBox>
    )
  }
}

export function iconTypeToImgSet (type: IconType) {
  return iconMeta[type].require
}

export function urlsToImgSet (imgMap: {[size: string]: string}, size: number): any {
  return Object.keys(imgMap).map(size => ({
    height: parseInt(size, 10),
    uri: imgMap[size],
    width: parseInt(size, 10),
  }))
}

export default Icon
