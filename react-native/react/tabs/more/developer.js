'use strict'
/* @flow */

import React, { Component, StyleSheet, Navigator, TextInput, View, Text } from 'react-native'
import { navigateUp } from '../../actions/router'
import { getDevSettings, saveDevSettings, updateDevSettings } from '../../actions/config'
import { bindActionCreators } from 'redux'

export default class Developer extends Component {
  componentDidMount () {
    this.props.getDevSettings()
  }

  componentWillUnmount () {
    this.props.saveDevSettings()
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
            onChangeText={ (val) => this.props.updateDevSettings({ [key]: val || null }) }
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
        rightButtonAction: bindActionCreators(navigateUp, store.dispatch),
        sceneConfig: Navigator.SceneConfigs.FloatFromBottom,
        mapStateToProps: state => {
          const { devConfig } = state.config
          return {
            devConfig
          }
        },
        props: {
          getDevSettings: bindActionCreators(getDevSettings, store.dispatch),
          saveDevSettings: bindActionCreators(saveDevSettings, store.dispatch),
          updateDevSettings: bindActionCreators(updateDevSettings, store.dispatch)
        }
      }
    }
  }
}

Developer.propTypes = {
  devConfig: React.PropTypes.object,
  getDevSettings: React.PropTypes.func.isRequired,
  saveDevSettings: React.PropTypes.func.isRequired,
  updateDevSettings: React.PropTypes.func.isRequired
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
