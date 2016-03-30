/* @flow */

import React, {Component} from 'react'
import {TouchableHighlight, Text, Image} from 'react-native'
import {globalColors} from '../styles/style-guide'
import {fontIcons, images} from './icon.paths.native'
import type {Props} from './icon'

export default class Icon extends Component {
  props: Props;

  _defaultColor (type: Props.type): ?string {
    switch (type) {
      case 'fa-custom-icon-proof-broken':
        return globalColors.red
      case 'fa-custom-icon-proof-good-followed':
        return globalColors.green
      case 'fa-custom-icon-proof-good-new':
        return globalColors.blue2
      case 'fa-close':
        return globalColors.black20
      default:
        return null
    }
  }

  _defaultHoverColor (type: Props.type): ?string {
    switch (type) {
      case 'fa-custom-icon-proof-broken':
      case 'fa-custom-icon-proof-good-followed':
      case 'fa-custom-icon-proof-good-new':
        return this._defaultColor(type)
      case 'fa-close':
        return globalColors.black60
      default:
        return null
    }
  }

  // Some types are the same underlying icon.
  _typeToIconMapper (type: Props.type): Props.type {
    switch (type) {
      case 'fa-custom-icon-proof-good-followed':
      case 'fa-custom-icon-proof-good-new':
        return 'fa-custom-icon-proof-good'
      default:
        return type
    }
  }

  render () {
    let color = this._defaultColor(this.props.type)
    let hoverColor = this._defaultHoverColor(this.props.type)
    let iconType = this._typeToIconMapper(this.props.type)

    if (!iconType) {
      console.error('Null iconType passed')
      return null
    }

    color = this.props.style && this.props.style.color || color || (this.props.opacity ? globalColors.lightGrey : globalColors.black40)
    hoverColor = this.props.style && this.props.style.hoverColor || hoverColor || (this.props.opacity ? globalColors.black : globalColors.black75)

    const width = this.props.style && this.props.style.width && {width: this.props.style.width}
    const height = this.props.style && this.props.style.height && {height: this.props.style.height}
    const fontSize = this.props.style && this.props.style.width && {fontSize: this.props.style.width}

    // Color is for our fontIcon and not the container
    let containerProps = {...this.props.style}
    delete containerProps.color

    console.log(color)

    return (
      <TouchableHighlight
        activeOpacity={0.8}
        underlayColor={globalColors.white}
        onPress={this.props.onClick}
        style={containerProps} >
        {fontIcons[iconType]
          ? <Text style={{color, fontFamily: 'kb', ...width, ...height, ...fontSize}}>{fontIcons[iconType]}</Text>
          : <Image source={images[this.props.type]} style={{resizeMode: 'contain', ...width, ...height}}/>
        }
      </TouchableHighlight>
    )
  }
}
