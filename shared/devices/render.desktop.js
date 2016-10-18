// @flow
import React, {Component} from 'react'
import type {IconType} from '../common-adapters/icon'
import type {Props} from './render'
import {Box, Text, Icon, PopupMenu} from '../common-adapters'
import flags from '../util/feature-flags'
import {globalStyles, globalColors, globalMargins} from '../styles'

type RevokedHeaderProps = {children?: Array<any>, onToggleExpanded: () => void}

function RevokedHeader (props: RevokedHeaderProps) {
  const iconType = props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'
  return (
    <Box>
      <Box style={stylesRevokedRow} onClick={props.onToggleExpanded}>
        <Text type='BodySmallSemibold' style={{color: globalColors.black_60}}>Revoked devices</Text>
        <Icon type={iconType} style={{padding: 5}} />
      </Box>
      {props.expanded && props.children}
    </Box>
  )
}

const DeviceRow = ({device, revoked, showExistingDevicePage}) => {
  const icon: IconType = {
    'mobile': 'icon-phone-bw-48',
    'desktop': 'icon-computer-bw-48',
    'backup': 'icon-paper-key-48',
  }[device.type]

  let textStyle = {fontStyle: 'italic'}
  if (revoked) {
    textStyle = {
      ...textStyle,
      color: globalColors.black_40,
      textDecoration: 'line-through',
    }
  }

  return (
    <Box
      className='existing-device-container'
      key={device.name}
      onClick={() => showExistingDevicePage(device)}
      style={{...stylesCommonRow, backgroundColor: revoked ? globalColors.white_40 : globalColors.white}}>
      <Box style={revoked ? {opacity: 0.2} : {}}>
        <Icon type={icon} />
      </Box>
      <Box style={{flex: 1, marginLeft: globalMargins.small}}>
        <Box style={{...globalStyles.flexBoxRow}}>
          <Text style={textStyle} type='BodySemibold'>{device.name}</Text>
        </Box>
        <Box style={{...globalStyles.flexBoxRow}}>
          {device.currentDevice && <Text type='BodySmall'>Current device</Text>}
        </Box>
      </Box>
    </Box>
  )
}

const RevokedDescription = () => (
  <Box style={stylesRevokedDescription}>
    <Text type='BodySmall' style={{color: globalColors.black_40}}>Revoked devices will no longer be able to access your Keybase account.</Text>
  </Box>
)

const RevokedDevices = ({revokedDevices, showExistingDevicePage, showingRevoked, onToggleShowRevoked}) => (
  <RevokedHeader expanded={showingRevoked} onToggleExpanded={onToggleShowRevoked}>
    <RevokedDescription />
    {revokedDevices.map(device => <DeviceRow key={device.name} device={device} revoked={true} showExistingDevicePage={showExistingDevicePage} />)}
  </RevokedHeader>
)

const DeviceHeader = ({addNewDevice, showingMenu, onHidden, menuItems}) => (
  <Box style={{...stylesCommonRow, ...globalStyles.clickable, backgroundColor: globalColors.white, height: globalMargins.xlarge}} onClick={addNewDevice}>
    <Icon type='icon-devices-add-64-x-48' />
    <Text type='BodyPrimaryLink' onClick={addNewDevice} style={{marginLeft: globalMargins.tiny}}>Add new...</Text>
    {showingMenu && <PopupMenu style={stylesPopup} items={menuItems} onHidden={onHidden} />}
  </Box>
)

type State = {showingMenu: boolean}

class DevicesRender extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      showingMenu: false,
    }
  }

  _items () {
    return [
      ...(flags.mobileAppsExist ? [{title: 'New Phone', onClick: () => this.props.addNewPhone()}] : []),
      {title: 'New Computer', onClick: () => this.props.addNewComputer()},
      {title: 'New Paper Key', onClick: () => this.props.addNewPaperKey()},
    ]
  }

  render () {
    const {devices, revokedDevices, showExistingDevicePage, showingRevoked, onToggleShowRevoked} = this.props

    return (
      <Box style={stylesContainer}>
        <DeviceHeader
          menuItems={this._items()}
          addNewDevice={() => this.setState({showingMenu: true})}
          showingMenu={this.state.showingMenu}
          onHidden={() => this.setState({showingMenu: false})} />
        {devices && devices.map(device => <DeviceRow key={device.name} device={device} showExistingDevicePage={showExistingDevicePage} />)}
        {revokedDevices && <RevokedDevices revokedDevices={revokedDevices} showExistingDevicePage={showExistingDevicePage} showingRevoked={showingRevoked} onToggleShowRevoked={onToggleShowRevoked} />}
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.scrollable,
  backgroundColor: globalColors.lightGrey,
  flexGrow: 1,
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  alignItems: 'center',
  borderTop: 'solid 1px rgba(0, 0, 0, .1)',
  height: 60,
  justifyContent: 'center',
  padding: 8,
}

const stylesRevokedRow = {
  ...stylesCommonRow,
  height: 30,
  justifyContent: 'flex-start',
  backgroundColor: globalColors.lightGrey,
}

const stylesRevokedDescription = {
  ...stylesCommonRow,
  backgroundColor: globalColors.lightGrey,
}

const stylesPopup = {
  marginLeft: 'auto',
  marginRight: 'auto',
  marginTop: 50,
}

export default DevicesRender
