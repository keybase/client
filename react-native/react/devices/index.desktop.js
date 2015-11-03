'use strict'
/* @flow */

import React from '../../base-react'
import BaseComponent from '../../base-component'

import HardwarePhoneIphone from 'material-ui/lib/svg-icons/hardware/phone-iphone'
import HardwareComputer from 'material-ui/lib/svg-icons/hardware/computer'
import CommunicationVpnKey from 'material-ui/lib/svg-icons/communication/vpn-key'
import ActionNoteAdd from 'material-ui/lib/svg-icons/action/note-add'

import View from 'react-flexbox'

export default class Devices extends BaseComponent {

  constructor (props) {
    super(props)
  }

  connectNew () {
    console.log("Add device")
  }

  addPaperKey () {
    console.log("Add paper key")
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Devices'
      }
    }
  }

  render () {

    return (
      <View column>
        <View row style={styles.deviceContainer}>
          <div style={Object.assign({}, styles.deviceOuter, styles.deviceAction)} onClick={() => this.connectNew()}>
            <div style={styles.device}>
              <ActionNoteAdd style={styles.deviceIcon} />
              <h3>Connect a new device</h3>
              <p style={Object.assign({}, styles.line4, styles.actionDesc)}>On another device, download Keybase then click here to enter your unique passphrase.</p>
            </div>
          </div>

          <div style={Object.assign({}, styles.deviceOuter, styles.deviceAction)} onClick={() => this.addPaperKey()}>
            <div style={styles.device}>
              <CommunicationVpnKey style={styles.deviceIcon} />
              <h3>Generate a new paper key</h3>
              <p style={Object.assign({}, styles.line4, styles.actionDesc)}>Portland Bushwick mumblecore.</p>
            </div>
          </div>
        </View>

        <View auto row style={styles.deviceContainer}>
          <div style={Object.assign({}, styles.deviceOuter, styles.deviceShow)}>
            <div style={styles.device}>
              <CommunicationVpnKey style={styles.deviceIcon} />
              <h3 style={styles.line2}>This is Long Device Name</h3>
              <div>Last used 08.05.15</div>
              <div>Paper key</div>
              <div><a href="">Remove</a></div>
            </div>
          </div>

          <div style={Object.assign({}, styles.deviceOuter, styles.deviceShow)}>
            <div style={styles.device}>
              <HardwareComputer style={styles.deviceIcon} />
              <h3 style={styles.line2}>Caley Work</h3>
              <div>Last used 08.03.15</div>
              <div style={styles.line2}>Added by "This is a Long Device Name"</div>
              <div><a href="">Remove</a></div>
            </div>
          </div>

          <div style={Object.assign({}, styles.deviceOuter, styles.deviceShow)}>
            <div style={styles.device}>
              <HardwarePhoneIphone style={styles.deviceIcon}/>
              <h3 style={styles.line2}>Caley iPhone</h3>
              <div>Last used 08.05.15</div>
              <div style={styles.line2}>Added by "Caley Work"</div>
              <div><a href="">Remove</a></div>
            </div>
          </div>
        </View>

      </View>
    )
  }
}

const styles = {
  deviceContainer: {
    flexWrap: 'wrap',
    justifyContent: 'flex-start'
  },
  deviceOuter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 200,
    height: 200,
    margin: 10,
    padding: 10,
  },
  device: {
    width: 200,
    textAlign: "center",
  },
  deviceAction: {
    backgroundColor: '#efefef',
    border: "dashed 2px #999",
    cursor: "pointer",
  },
  deviceShow: {
    border: "solid 1px #999",
  },
  deviceIcon: {
    width: 48,
    height: 48,
    textAlign: "center"
  },
  actionDesc: {
  },

  // These might be good globals
  line1: {
    overflow: "hidden",
    display: "-webkit-box",
    textOverflow: "ellipsis",
    WebkitLineClamp: 1,
    WebkitBoxOrient: "vertical",
  },
  line2: {
    overflow: "hidden",
    display: "-webkit-box",
    textOverflow: "ellipsis",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  line4: {
    overflow: "hidden",
    display: "-webkit-box",
    textOverflow: "ellipsis",
    WebkitLineClamp: 4,
    WebkitBoxOrient: "vertical",
  }
};
