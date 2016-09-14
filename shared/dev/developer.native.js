// @flow
import React, {Component} from 'react'
import {NativeNavigator, NativeTextInput, Box, Text} from '../common-adapters/index.native'
import {connect} from 'react-redux'
import {getDevSettings, saveDevSettings, updateDevSettings} from '../actions/config'

class Developer extends Component {
  componentDidMount () {
    this.props.getDevSettings()
  }

  componentWillUnmount () {
    this.props.saveDevSettings()
  }

  render () {
    if (!this.props.devConfig) {
      return (
        <Box
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text type='Body'>Loading…</Text>
        </Box>
      )
    }
    let settingNodes = this.props.devConfig.keys.map(key => {
      return (
        <Box style={styles.group} key={key}>
          <Text type='Body' style={styles.label}>{key.replace(/(?!^)(?=[A-Z][a-z])/g, ' ')}</Text>
          <NativeTextInput
            placeholder={this.props.devConfig.defaults[key]}
            value={this.props.devConfig.configured[key]}
            style={styles.input}
            clearButtonMode='always'
            onChangeText={val => this.props.updateDevSettings({[key]: val || null})}
          />
        </Box>
      )
    })
    return (
      <Box style={styles.container}>
        {settingNodes}
      </Box>
    )
  }

  static parseRoute () {
    return {componentAtTop: {title: 'Developer', sceneConfig: NativeNavigator.SceneConfigs.FloatFromBottom}}
  }
}

const styles = {
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: 'red',
  },
  group: {
    margin: 10,
  },
  label: {
  },
  input: {
    height: 40,
    borderWidth: 0.5,
    borderColor: '#0f0f0f',
    fontSize: 13,
    padding: 4,
  },
  submitWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  navBarRightButton: {
    fontSize: 16,
    marginVertical: 10,
    paddingRight: 10,
    color: 'blue',
  },
}

export default connect(
  (state: any) => {
    const {devConfig} = state.config
    return {devConfig}
  },
  (dispatch: any) => {
    return {
      getDevSettings: () => dispatch(getDevSettings()),
      saveDevSettings: () => dispatch(saveDevSettings()),
      updateDevSettings: settings => dispatch(updateDevSettings(settings)),
    }
  }
)(Developer)
