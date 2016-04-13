/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {View} from 'react-native'
import {Text} from '../../common-adapters'
import type {Props} from './username-email-form.render'

export default class Render extends Component {
  props: Props;

  render () {
    return <View><Text>foo</Text></View>
  }
}
