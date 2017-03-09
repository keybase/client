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
        <Icon type={iconType} style={{padding: globalMargins.xtiny}} />
      </Box>
      {props.expanded && props.children}
    </Box>
  )
}

const DeviceRow = ({device, revoked, showExistingDevicePage}) => {
  const icon: IconType = {
    'mobile': 'icon-phone-32',
    'desktop': 'icon-computer-32',
    'backup': 'icon-paper-key-32',
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
      style={{...stylesCommonRow, borderBottom: '1px solid rgba(0,0,0,.05)'}}>
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
  <Box style={{...stylesCommonRow, ...globalStyles.clickable, backgroundColor: globalColors.white, height: 48}} onClick={addNewDevice}>
    <Icon type='iconfont-new' style={{color: globalColors.blue}} />
    <Text type='BodyBigLink' onClick={addNewDevice} style={{marginLeft: globalMargins.tiny}}>Add new...</Text>
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
      {title: 'New computer', onClick: () => this.props.addNewComputer()},
      {title: 'New paper key', onClick: () => this.props.addNewPaperKey()},
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
  flexGrow: 1,
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  alignItems: 'center',
  height: 48,
  justifyContent: 'center',
  padding: 8,
}

const stylesRevokedRow = {
  ...stylesCommonRow,
  height: 24,
  justifyContent: 'flex-start',
}

const stylesRevokedDescription = {
  ...stylesCommonRow,
  height: 24,
}

const stylesPopup = {
  marginLeft: 'auto',
  marginRight: 'auto',
  marginTop: 50,
}

export default DevicesRender
