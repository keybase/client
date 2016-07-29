// @flow
import * as shared from './icon.shared'
import React, {Component} from 'react'
import type {Props} from './icon'
import {TouchableHighlight, Text, Image} from 'react-native'
import {globalColors} from '../styles/style-guide'
import {iconMeta} from './icon.constants'

class Icon extends Component<void, Props, void> {
  render () {
    let color = shared.defaultColor(this.props.type)
    let iconType = shared.typeToIconMapper(this.props.type)

    if (!iconType) {
      console.warn('Null iconType passed')
      return null
    }

    color = this.props.style && this.props.style.color || color || (this.props.opacity ? globalColors.lightGrey : globalColors.black_40)

    const width = this.props.style && this.props.style.width && {width: this.props.style.width}
    const height = this.props.style && this.props.style.height && {height: this.props.style.height}

    const fontSize = this.props.style && (this.props.style.fontSize || this.props.style.width)
    const textAlign = this.props.style && this.props.style.textAlign

    // Color is for our fontIcon and not the container
    let containerProps = {...this.props.style}
    delete containerProps.color
    delete containerProps.width
    delete containerProps.height
    delete containerProps.textAlign
    delete containerProps.fontSize

    if (!iconMeta[iconType]) {
      console.warn(`Invalid icon type passed in: ${iconType}`)
      return null
    }

    const icon = iconMeta[iconType].isFont
      ? <Text style={{color, textAlign, fontFamily: 'kb', fontSize: fontSize, ...width}}>{
        String.fromCharCode(iconMeta[iconType].charCode || 0)}</Text>
      : <Image source={iconMeta[iconType].require} style={{resizeMode: 'contain', ...width, ...height}} />

    return (
      <TouchableHighlight
        activeOpacity={0.8}
        underlayColor={this.props.underlayColor || globalColors.white}
        onPress={this.props.onClick || (() => {})}
        disabled={!(this.props.onClick)}
        style={{...containerProps}}>
        {icon}
      </TouchableHighlight>
    )
  }
}

export default Icon
