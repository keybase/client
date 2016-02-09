/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'

// $FlowFixMe React native issues + flow
import {StyleSheet, View} from 'react-native'

// $FlowFixMe type annotate this
import ProgressIndicator from '../common-adapters/progress-indicator'

import type {Props} from './form.render'

export default class LoginRender extends Component {
  props: Props;

  render () {
    return (
      <View style={styles.container}>
        <ProgressIndicator/>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
