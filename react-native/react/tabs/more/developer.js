'use strict'
/* @flow */

import React, { Component, StyleSheet, Navigator, TextInput, View, Text } from 'react-native'
import { navigateUp } from '../../actions/router'
import { getDevSettings, saveDevSettings, updateDevSettings } from '../../actions/config'

export default class Developer extends Component {
  constructor (props) {
    super(props)

    this.state = { }
  }

  componentDidMount () {
    this.props.dispatch(getDevSettings())
  }

  componentWillUnmount () {
    this.props.dispatch(saveDevSettings())
  }

  render () {
    if (!this.props.devConfig) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
          <Text>Loading…</Text>
        </View>
      )
    }
    let settingNodes = this.props.devConfig.keys.map((key) => {
      return (
        <View style={styles.group} key={key}>
          <Text style={styles.label}>{key.replace(/(?!^)(?=[A-Z][a-z])/g, ' ')}</Text>
          <TextInput
            placeholder={this.props.devConfig.defaults[key]}
            value={this.props.devConfig.configured[key]}
            style={styles.input}
            clearButtonMode='always'
            onChangeText={ (val) => this.props.dispatch(updateDevSettings({ [key]: val || null })) }
          />
        </View>
      )
    })
    return (
      <View style={styles.container}>
        {settingNodes}
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Developer',
        rightButtonAction: navigateUp(),
        sceneConfig: Navigator.SceneConfigs.FloatFromBottom,
        mapStateToProps: state => state.config
      }
    }
  }
}

Developer.propTypes = {
  dispatch: React.PropTypes.func.isRequired,
  devConfig: React.PropTypes.object
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: 'red'
  },
  group: {
    margin: 10
  },
  label: {
  },
  input: {
    height: 40,
    borderWidth: 0.5,
    borderColor: '#0f0f0f',
    fontSize: 13,
    padding: 4
  },
  submitWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  },
  navBarRightButton: {
    fontSize: 16,
    marginVertical: 10,
    paddingRight: 10,
    color: 'blue'
  }
})
