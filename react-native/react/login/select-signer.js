'use strict'

import React from 'react-native'
import {
  Component,
  ListView,
  StyleSheet,
  View,
  Text,
  TouchableHighlight
} from 'react-native'

import { submitDeviceSigner } from '../actions/login'

import commonStyles from '../styles/common'
import enums from '../keybase_v1'

class SelectSigner extends Component {
  constructor (props) {
    super(props)
  }

  componentWillMount () {
    const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2})

    const devices = this.props.devices.map(function (d) {
      const desc = `Use the device named ${d.name} to authorize this installation`

      return {
        ...d,
        desc: desc
      }
    })

    if (this.props.hasPGP) {
      devices.push({
        name: 'PGP Key',
        desc: 'Use your PGP key'
      })
    }

    this.state = {
      dataSource: ds.cloneWithRows(devices)
    }
  }

  select (rowData) {
    const signer = {
      deviceID: rowData.deviceID,
      deviceName: rowData.name,
      kind: enums.locksmithUi.DeviceSignerKind.device
    }

    if (!rowData.deviceID) {
      signer.kind = enums.locksmithUi.DeviceSignerKind.pgp
    }

    this.props.onSubmit({
      action: enums.locksmithUi.SelectSignerAction.sign,
      signer
    })
  }

  renderRow (rowData, sectionID, rowID) {
    const sep = (rowID < (this.state.dataSource.getRowCount() - 1)) ? <View style={styles.separator} /> : null

    return (
      <TouchableHighlight
        underlayColor={commonStyles.buttonHighlight}
        onPress={() => { this.select(rowData) }}>
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
    return (
      <View style={styles.container}>
        <ListView style={{}}
        dataSource={this.state.dataSource}
        renderRow={(...args) => { return this.renderRow(...args) }}
        renderSectionHeader={() => {
          return <Text style={{margin: 10}}>This is the first time you've logged into this computer. You need to setup and verify this installation of Keybase. Which method do you want to use?</Text>
        }}
        />
      </View>
    )
  }

  static parseRoute (store) {
    const {signers, response} = store.getState().login
    const componentAtTop = {
      title: 'Device Setup',
      leftButtonTitle: 'Cancel',
      component: SelectSigner,
      mapStateToProps: state => state.login,
      props: {
        onSubmit: (result) => store.dispatch(submitDeviceSigner(result, response)),
        ...signers
      }
    }

    return {
      componentAtTop,
      parseNextRoute: null // terminal node, so no next route
    }
  }
}

SelectSigner.propTypes = {
  navigator: React.PropTypes.object,
  devices: React.PropTypes.array,
  hasPGP: React.PropTypes.bool,
  hasPaperBackupKey: React.PropTypes.bool,
  onSubmit: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF'
  },
  separator: {
    height: 1,
    backgroundColor: '#CCCCCC'
  }
})

export default SelectSigner
