// @flow
import React, {Component} from 'react'
import {Animated, View, StyleSheet, Dimensions} from 'react-native'
import {globalColors} from '../styles/style-guide'
import type {Props} from './action-sheet'

class ActionSheet extends Component {
  state: {
    opacity: any
  };

  constructor (props: Props) {
    super(props)

    this.state = {
      opacity: new Animated.Value(0)
    }
  }

  componentWillMount () {
    Animated.timing(this.state.opacity, {
      toValue: 1,
      duration: 300
    }).start()
  }

  render (): React$Element {
    return (
      <Animated.View style={[styles.container, {opacity: this.state.opacity}]}>
        {this.props.children}
      </Animated.View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: globalColors.black10,
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    height: Dimensions.get('window').height,
    width: Dimensions.get('window').width
  }
})

export default ActionSheet
