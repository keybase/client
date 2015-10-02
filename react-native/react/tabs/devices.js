'use strict'
/* @flow */

import React from 'react-native'
const {
  ActivityIndicatorIOS,
  ProgressBarAndroid,
  Platform,
  Component,
  ListView,
  Text,
  TouchableHighlight,
  TouchableNativeFeedback,
  View
} = React

import commonStyles from '../styles/common'
import { loadDevices } from '../actions/devices'
import moment from 'moment'

export default class Devices extends Component {
  constructor (props) {
    super(props)

    this.state = {
      ...this.buildDataSource(props)
    }
  }

  loadDevices () {
    const {dispatch} = this.props
    if (!this.props.devices && !this.props.waitingForServer) {
      dispatch(loadDevices())
    }
  }

  componentDidMount () {
    if (Platform.OS === 'ios') {
      this.loadDevices()
    }
  }

  buildDataSource (props) {
    const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2})

    const devices = !props.devices ? [] : props.devices.map(function (d) {
      const desc = `A ${d.type} with id: ${d.deviceID} added on ${moment(d.cTime).format('dddd, MMMM Do YYYY, h:mm:ss a')}`
      return {
        ...d,
        desc: desc
      }
    })

    return { dataSource: ds.cloneWithRows(devices) }
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.devices !== this.props.devices) {
      this.setState(this.buildDataSource(nextProps))
    }
  }

  renderRow (rowData, sectionID, rowID) {
    const sep = (rowID < (this.state.dataSource.getRowCount() - 1)) ? <View style={commonStyles.separator} /> : null

    return (
      <TouchableHighlight
        underlayColor={commonStyles.buttonHighlight}
        onPress={() => {}}>
        <View>
          <View style={{margin: 10}}>
            <Text>{rowData.name}</Text>
            <Text style={{fontSize: 10}}>{rowData.desc}</Text>
          </View>
          {sep}
        </View>
      </TouchableHighlight>
    )
  }

  render () {
    if (Platform.OS === 'android') {
      // TODO: instead of forcing the user to click a button to load the devices we
      // should do this a better way
      // Currently all tabs are loaded on start, so this would load when they open the app
      if (!this.props.waitingForServer && !this.props.devices) {
        return (
          <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
            <TouchableNativeFeedback
              onPress={this.loadDevices.bind(this)}>
              <View>
                <Text style={{fontSize: 32, marginTop: 20, marginBottom: 20}}>Load Devices</Text>
              </View>
            </TouchableNativeFeedback>
          </View>
        )
      } else if (this.props.waitingForServer) {
        return (
          <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
            <ProgressBarAndroid/>
          </View>
        )
      }
    }
    if (this.props.waitingForServer) {
      return (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicatorIOS
          animating
          style={{height: 80}}
          size='large'
          />
        </View>
      )
    }

    return (
      <ListView style={{flex: 1}}
        dataSource={this.state.dataSource}
        renderRow={(...args) => { return this.renderRow(...args) }}
      />
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Devices',
        component: Devices,
        mapStateToProps: state => state.devices
      },
      parseNextRoute: null
    }
  }
}

Devices.propTypes = {
  dispatch: React.PropTypes.func.isRequired,
  devices: React.PropTypes.array,
  waitingForServer: React.PropTypes.bool.isRequired
}
