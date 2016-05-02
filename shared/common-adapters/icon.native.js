/* @flow */

import React, {Component} from 'react'
import {TouchableHighlight, Text, Image} from 'react-native'
import {globalColors} from '../styles/style-guide'
import {fontIcons, images} from './icon.paths.native'
import type {Props} from './icon'
import * as shared from './icon.shared'

export default class Icon extends Component {
  props: Props;

  render () {
    let color = shared.defaultColor(this.props.type)
    let iconType = shared.typeToIconMapper(this.props.type)

    if (!iconType) {
      console.warn('Null iconType passed')
      return null
    }

    color = this.props.style && this.props.style.color || color || (this.props.opacity ? globalColors.lightGrey : globalColors.black40)

    const width = this.props.style && this.props.style.width && {width: this.props.style.width}
    const height = this.props.style && this.props.style.height && {height: this.props.style.height}
    const fontSize = this.props.style && this.props.style.width && {fontSize: this.props.style.width}

    // Color is for our fontIcon and not the container
    let containerProps = {...this.props.style}
    delete containerProps.color
    delete containerProps.width
    delete containerProps.height

    const icon = fontIcons[iconType]
      ? <Text style={{color, fontFamily: 'kb', ...fontSize}}>{fontIcons[iconType]}</Text>
      : <Image source={images[this.props.type]} style={{resizeMode: 'contain', ...width, ...height}} />

    return (
      <TouchableHighlight
        activeOpacity={0.8}
        underlayColor={globalColors.white}
        onPress={this.props.onClick || (() => {})}
        disabled={!(this.props.onClick)}
        style={containerProps}>
        {icon}
      </TouchableHighlight>
    )
  }
}
