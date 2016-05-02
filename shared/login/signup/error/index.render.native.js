/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {View} from 'react-native'

import type {Props} from './index.render'

export default class Render extends Component {
  props: Props;

  render () {
    return <View />
  }
}

