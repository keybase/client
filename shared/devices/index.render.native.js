import React, {Component, Text, TouchableHighlight, View, ScrollView, StyleSheet} from '../base-react'
import moment from 'moment'
import commonStyles from '../styles/common'

export default class DevicesRender extends Component {

  renderDevice (device) {
    return (
      <View key={device.name} style={[styles.device]}>
        <Text style={commonStyles.greyText}>ICON {device.type}</Text>
        <Text style={styles.deviceName}>{device.name}</Text>
        <Text style={[styles.deviceLastUsed, commonStyles.greyText]}>Last Used: {moment(device.cTime).format('MM/DD/YY')}</Text>
        <Text style={[styles.deviceAddedInfo, commonStyles.greyText]}>TODO: Get Added info</Text>
        <Text style={styles.deviceRemove} onPress={() => this.props.showRemoveDevicePage(device)}>Remove</Text>
      </View>
    )
  }

  renderAction (headerText, subText, onPress) {
    return (
      <TouchableHighlight onPress={onPress} style={{flex: 1}}>
        <View style={[styles.outlineBox, styles.innerAction, {marginRight: 10}]}>
          <View style={{flex: 1}}>
            <Text style={[commonStyles.greyText, commonStyles.centerText]}>ICON</Text>
            <Text style={[commonStyles.greyText, commonStyles.centerText]}>{headerText}</Text>
          </View>
          <Text style={[commonStyles.greyText, commonStyles.centerText]}>{subText}</Text>
        </View>
      </TouchableHighlight>
    )
  }

  render () {
    return (
      <ScrollView>
        <View doc='Wrapper for new Actions (i.e. Connect a new device, Generate new paper key)'
          style={styles.newActionsWrapper}>
          {this.renderAction('Connect a new Device',
                             'On another device, download Keybase then click here to enter your unique passphrase',
                             () => this.props.showExistingDevicePage())}
          {this.renderAction('Generate a new paper key',
                             'A paper key is lorem ipsum dolor sit amet, consectetur adipiscing',
                             () => this.props.showGenPaperKeyPage())}
        </View>

        <View doc='Wrapper for devices' style={styles.deviceWrapper}>
          {this.props.devices && this.props.devices.map(d => this.renderDevice(d))}
        </View>
      </ScrollView>
    )
  }
}

DevicesRender.propTypes = {
  devices: React.PropTypes.array,
  waitingForServer: React.PropTypes.bool.isRequired,
  showRemoveDevicePage: React.PropTypes.func.isRequired,
  showExistingDevicePage: React.PropTypes.func.isRequired,
  showGenPaperKeyPage: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  outlineBox: {
    backgroundColor: '#f4f4f4',
    borderWidth: 2,
    borderColor: '#999999',
    // TODO: this doesn't work
    borderStyle: 'dotted'
  },
  newActionsWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    marginRight: 10,
    marginLeft: 10,
    marginTop: 20,
    flex: 1
  },
  innerAction: {
    flex: 1,
    padding: 10,
    alignItems: 'stretch'
  },

  // Device Styling
  deviceScrollView: {
  },
  deviceWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginRight: 10,
    marginLeft: 10,
    marginTop: 20
  },
  device: {
    width: 100,
    marginRight: 10,
    marginLeft: 10,
    marginBottom: 20
  },
  deviceName: {
  },
  deviceLastUsed: {
  },
  deviceAddedInfo: {
  },
  deviceRemove: {
    textDecorationLine: 'underline'
  }
})
