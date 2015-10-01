'use strict'
/* @flow */

import React from 'react-native'
const {
  ActivityIndicatorIOS,
  Component,
  ListView,
  Text,
  TouchableHighlight,
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

  componentDidMount () {
    const {dispatch} = this.props

    if (!this.props.devices) {
      dispatch(loadDevices())
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
