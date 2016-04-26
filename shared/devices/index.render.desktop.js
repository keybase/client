/* @flow */
import React from 'react'
import {Box, Text, Icon, Button} from '../common-adapters'

import HardwarePhoneIphone from 'material-ui/lib/svg-icons/hardware/phone-iphone'
import HardwareComputer from 'material-ui/lib/svg-icons/hardware/computer'
import CommunicationVpnKey from 'material-ui/lib/svg-icons/communication/vpn-key'
import ActionNoteAdd from 'material-ui/lib/svg-icons/action/note-add'

import moment from 'moment'
import commonStyles from '../styles/common'

import type {Props} from './index'
import type {Device} from '../constants/types/flow-types'

const renderPhone = (device: Device) => {
  return (
    <Box key={device.deviceID} style={{...styles.deviceOuter, ...styles.deviceShow}}>
      <Box style={styles.device}>
        <HardwarePhoneIphone style={styles.deviceIcon}/>
        <h3 style={styles.line2}>{device.name}</h3>
        <Box>Last used {moment(device.cTime).format('MM/DD/YY')}</Box>
        <Box style={styles.line2}>TODO: Get Added info</Box>
        <p style={{...commonStyles.clickable, textDecoration: 'underline'}} onClick={() => {}}>Remove</p>
      </Box>
    </Box>
  )
}

const renderDesktop = (device: Device) => {
  return (
    <Box key={device.deviceID} style={{...styles.deviceOuter, ...styles.deviceShow}}>
      <Box style={styles.device}>
        <HardwareComputer style={styles.deviceIcon} />
        <h3 style={styles.line2}>{device.name}</h3>
        <Box>Last used {moment(device.cTime).format('MM/DD/YY')}</Box>
        <Box style={styles.line2}>TODO: Get Added info</Box>
        <p style={{...commonStyles.clickable, textDecoration: 'underline'}} onClick={() => {}}>Remove</p>
      </Box>
    </Box>
  )
}

const renderPaperKey = (device: Device) => {
  return (
    <Box key={device.deviceID} style={{...styles.deviceOuter, ...styles.deviceShow}}>
      <Box style={styles.device}>
        <CommunicationVpnKey style={styles.deviceIcon} />
        <h3 style={styles.line2}>{device.name}</h3>
        <Box>Last used {moment(device.cTime).format('MM/DD/YY')}</Box>
        <Box>Paper key</Box>
        <p style={{...commonStyles.clickable, textDecoration: 'underline'}} onClick={() => {}}>Remove</p>
      </Box>
    </Box>
  )
}

const renderDevice = device => {
  console.log('in RenderDevice for ')
  console.log(device)
  if (device.type === 'desktop') {
    return renderDesktop(device)
  } else if (device.type === 'mobile') {
    return renderPhone(device)
  } else if (device.type === 'backup') {
    return renderPaperKey(device)
  } else {
    console.warn('Unknown device type: ' + device.type)
  }
}

const Render = ({devices, waitingForServer, showRemoveDevicePage, showExistingDevicePage, showGenPaperKeyPage}: Props) => {
  return (
    <Box>
      <Box style={styles.deviceContainer}>
        <Box style={{...styles.deviceOuter, ...styles.deviceAction}} onClick={() => showExistingDevicePage()}>
          <Box style={styles.device}>
            <ActionNoteAdd style={styles.deviceIcon} />
            <h3>Connect a new device</h3>
            <p style={{...styles.line4, ...styles.actionDesc}}>On another device, download Keybase then click here to enter your unique passphrase.</p>
          </Box>
        </Box>

        <Box style={{...styles.deviceOuter, ...styles.deviceAction}} onClick={() => showGenPaperKeyPage()}>
          <Box style={styles.device}>
            <CommunicationVpnKey style={styles.deviceIcon} />
            <h3>Generate a new paper key</h3>
            <p style={{...styles.line4, ...styles.actionDesc}}>Portland Bushwick mumblecore.</p>
          </Box>
        </Box>
      </Box>

      <Box style={styles.deviceContainer}>
        {devices && devices.map(device => renderDevice(device))}
      </Box>
    </Box>
  )
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

export default Render
