/* @flow */
import React, {Component} from 'react'
import {View} from 'react-native'

import Header from './header.render'
import {UserBio, UserProofs} from '../common-adapters'
import Action from './action.render'

import type {RenderProps} from './render'

export default class Render extends Component<void, RenderProps, void> {
  props: RenderProps;

  render () {
    return (
      <View style={styles.container}>
        <Header {...this.props.headerProps} />
        <View style={styles.content}>
          <UserBio type='Tracker' {...this.props.bioProps} avatarSize={80} />
          <UserProofs {...this.props.proofsProps} />
        </View>
        <Action {...this.props.actionProps} />
      </View>
    )
  }
}

const styles = {
  container: {
    backgroundColor: 'red',
    flexDirection: 'column',
  },
  content: {
    backgroundColor: 'green',
  },
}
