// @flow
import React, {Component} from 'react'
import type {IconType} from '../common-adapters/icon'
import type {Props} from './render'
import {Box, Text, Icon} from '../common-adapters'
import {View, TouchableHighlight, ActionSheetIOS, ScrollView} from 'react-native'
import {globalStyles, globalColors} from '../styles/style-guide'

const DeviceRow = ({device, revoked, showRemoveDevicePage, showExistingDevicePage}) => {
  const icon: IconType = {
    'mobile': 'icon-phone-bw-48',
    'desktop': 'icon-computer-bw-48',
    'backup': 'icon-paper-key-48',
  }[device.type]

  let textStyle = {fontStyle: 'italic', flex: 0}
  if (revoked) {
    textStyle = {
      ...textStyle,
      color: globalColors.black_40,
      textDecorationLine: 'line-through',
      textDecorationStyle: 'solid',
    }
  }

  return (
    <TouchableHighlight onPress={() => showExistingDevicePage(device)} style={{...stylesCommonRow, alignItems: 'center', ...(revoked ? {backgroundColor: globalColors.white_40} : {})}}>
      <Box key={device.name} style={{...globalStyles.flexBoxRow, flex: 1, alignItems: 'center'}}>
        <Icon type={icon} style={revoked ? {marginRight: 16, opacity: 0.2} : {marginRight: 16}} />
        <View style={{...globalStyles.flexBoxColumn, justifyContent: 'flex-start', flex: 1}}>
          <Text style={textStyle} type='BodySemibold'>{device.name}</Text>
          {device.currentDevice && <Text type='BodySmall'>Current device</Text>}
        </View>
        <TouchableHighlight onPress={() => showRemoveDevicePage(device)}>
          <View>{!revoked && <Text style={{color: globalColors.red, paddingLeft: 16}} type='BodyPrimaryLink'>Revoke</Text>}</View>
        </TouchableHighlight>
      </Box>
    </TouchableHighlight>
  )
}

const RevokedDescription = () => (
  <Box style={stylesRevokedDescription}>
    <Text type='BodySmallSemibold' style={{color: globalColors.black_40, textAlign: 'center'}}>Revoked devices will no longer be able to access your Keybase account.</Text>
  </Box>
)

type RevokedHeaderState = {expanded: boolean}
class RevokedDevices extends Component<void, {revokedDevices: Array<Object>}, RevokedHeaderState> {
  state: RevokedHeaderState;

  constructor (props: Props) {
    super(props)
    this.state = {expanded: false}
  }

  _toggleHeader (e) {
    this.setState({expanded: !this.state.expanded})
  }

  render () {
    if (!this.props.revokedDevices) {
      return null
    }

    const iconType = this.state.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'

    return (
      <Box>
        <TouchableHighlight onPress={e => this._toggleHeader(e)}>
          <Box style={stylesRevokedRow}>
            <Text type='BodySemibold'>Revoked devices</Text>
            <Icon type={iconType} style={{padding: 5}} />
          </Box>
        </TouchableHighlight>
        {this.state.expanded && <RevokedDescription />}
        {this.state.expanded && this.props.revokedDevices.map(device => <DeviceRow key={device.name} device={device} revoked={true} />)}
      </Box>)
  }
}

const DeviceHeader = ({addNewPhone, addNewComputer, addNewPaperKey}) => {
  const items = [
    {title: 'New Phone', onClick: () => addNewPhone()},
    {title: 'New Computer', onClick: () => addNewComputer()},
    {title: 'New Paper Key', onClick: () => addNewPaperKey()},
    {title: 'Cancel', onClick: () => {}},
  ]

  return <Box style={{...stylesCommonRow, alignItems: 'center'}}>
    <Box style={stylesCommonColumn}>
      <Icon type='icon-devices-add-64-x-48' />
    </Box>
    <Box style={stylesCommonColumn}>
      <Text type='BodyPrimaryLink' onClick={() => ActionSheetIOS.showActionSheetWithOptions({
        title: 'Add a new device',
        options: items.map(i => i.title),
        cancelButtonIndex: items.length - 1,
      }, idx => idx !== -1 && setImmediate(items[idx].onClick)
      )}>Add new...</Text>
    </Box>
  </Box>
}

const Render = ({devices, revokedDevices, waitingForServer, showRemoveDevicePage, showExistingDevicePage, addNewPhone, addNewComputer, addNewPaperKey}: Props) => (
  <Box style={stylesContainer}>
    <DeviceHeader addNewPhone={addNewPhone} addNewComputer={addNewComputer} addNewPaperKey={addNewPaperKey} />
    <ScrollView style={{...globalStyles.flexBoxColumn, flex: 1}}>
      {devices && devices.map(device => <DeviceRow key={device.name} device={device} showRemoveDevicePage={showRemoveDevicePage} showExistingDevicePage={showExistingDevicePage} />)}
      <RevokedDevices revokedDevices={revokedDevices} />
    </ScrollView>
  </Box>
)

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const stylesCommonCore = {
  borderBottomColor: globalColors.black_10,
  borderBottomWidth: 1,
  alignItems: 'center',
  justifyContent: 'center',
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  ...stylesCommonCore,
  padding: 8,
  minHeight: 64,
}

const stylesRevokedRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  paddingLeft: 8,
  minHeight: 38,
  justifyContent: 'flex-start',
  backgroundColor: globalColors.lightGrey,
}

const stylesRevokedDescription = {
  ...globalStyles.flexBoxColumn,
  ...stylesCommonCore,
  alignItems: 'center',
  paddingLeft: 32,
  paddingRight: 32,
  backgroundColor: globalColors.lightGrey,
}

const stylesCommonColumn = {
  padding: 5,
}

export default Render
