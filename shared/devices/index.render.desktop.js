import React, {Component} from '../base-react'

import HardwarePhoneIphone from 'material-ui/lib/svg-icons/hardware/phone-iphone'
import HardwareComputer from 'material-ui/lib/svg-icons/hardware/computer'
import CommunicationVpnKey from 'material-ui/lib/svg-icons/communication/vpn-key'
import ActionNoteAdd from 'material-ui/lib/svg-icons/action/note-add'

import moment from 'moment'
import View from 'react-flexbox'
import commonStyles from '../styles/common'

export default class DevicesRender extends Component {
  renderPhone (device) {
    return (
      <div key={device.deviceID} style={{...styles.deviceOuter, ...styles.deviceShow}}>
        <div style={styles.device}>
          <HardwarePhoneIphone style={styles.deviceIcon}/>
          <h3 style={styles.line2}>{device.name}</h3>
          <div>Last used {moment(device.cTime).format('MM/DD/YY')}</div>
          <div style={styles.line2}>TODO: Get Added info</div>
          <p style={{...commonStyles.clickable, textDecoration: 'underline'}} onClick={() => this.props.showRemoveDevicePage(device)}>Remove</p>
        </div>
      </div>
    )
  }

  renderDesktop (device) {
    return (
      <div key={device.deviceID} style={{...styles.deviceOuter, ...styles.deviceShow}}>
        <div style={styles.device}>
          <HardwareComputer style={styles.deviceIcon} />
          <h3 style={styles.line2}>{device.name}</h3>
          <div>Last used {moment(device.cTime).format('MM/DD/YY')}</div>
          <div style={styles.line2}>TODO: Get Added info</div>
          <p style={{...commonStyles.clickable, textDecoration: 'underline'}} onClick={() => this.props.showRemoveDevicePage(device)}>Remove</p>
        </div>
      </div>
    )
  }

  renderPaperKey (device) {
    return (
      <div key={device.deviceID} style={{...styles.deviceOuter, ...styles.deviceShow}}>
        <div style={styles.device}>
          <CommunicationVpnKey style={styles.deviceIcon} />
          <h3 style={styles.line2}>{device.name}</h3>
          <div>Last used {moment(device.cTime).format('MM/DD/YY')}</div>
          <div>Paper key</div>
          <p style={{...commonStyles.clickable, textDecoration: 'underline'}} onClick={() => this.props.showRemoveDevicePage(device)}>Remove</p>
        </div>
      </div>
    )
  }

  renderDevice (device) {
    if (device.type === 'desktop') {
      return this.renderDesktop(device)
    } else if (device.type === 'mobile') {
      return this.renderPhone(device)
    } else if (device.type === 'backup') {
      return this.renderPaperKey(device)
    } else {
      console.error('Unknown device type: ' + device.type)
    }
  }

  render () {
    return (
      <View column>
        <View row style={styles.deviceContainer}>
          <div style={{...styles.deviceOuter, ...styles.deviceAction}} onClick={() => this.props.showExistingDevicePage()}>
            <div style={styles.device}>
              <ActionNoteAdd style={styles.deviceIcon} />
              <h3>Connect a new device</h3>
              <p style={{...styles.line4, ...styles.actionDesc}}>On another device, download Keybase then click here to enter your unique passphrase.</p>
            </div>
          </div>

          <div style={{...styles.deviceOuter, ...styles.deviceAction}} onClick={() => this.props.showGenPaperKeyPage()}>
            <div style={styles.device}>
              <CommunicationVpnKey style={styles.deviceIcon} />
              <h3>Generate a new paper key</h3>
              <p style={{...styles.line4, ...styles.actionDesc}}>Portland Bushwick mumblecore.</p>
            </div>
          </div>
        </View>

        <View auto row style={styles.deviceContainer}>
          { this.props.devices && this.props.devices.map(device => this.renderDevice(device)) }
        </View>
      </View>
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

const styles = {
  deviceContainer: {
    flexWrap: 'wrap',
    justifyContent: 'flex-start'
  },
  deviceOuter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 200,
    margin: 10,
    padding: 10
  },
  device: {
    width: 200,
    textAlign: 'center'
  },
  deviceAction: {
    backgroundColor: '#efefef',
    border: 'dashed 2px #999',
    cursor: 'pointer'
  },
  deviceShow: {
    border: 'solid 1px #999'
  },
  deviceIcon: {
    width: 48,
    height: 48,
    textAlign: 'center'
  },
  actionDesc: {
  },

  // These might be good globals
  line1: {
    overflow: 'hidden',
    display: '-webkit-box',
    textOverflow: 'ellipsis',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical'
  },
  line2: {
    overflow: 'hidden',
    display: '-webkit-box',
    textOverflow: 'ellipsis',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  },
  line4: {
    overflow: 'hidden',
    display: '-webkit-box',
    textOverflow: 'ellipsis',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical'
  }
}
