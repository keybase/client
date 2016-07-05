/* @flow */
import React, {Component} from 'react'
import {Box, Text, Icon, PopupMenu} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import type {IconType} from '../common-adapters/icon'
import type {Props} from './render'

type RevokedHeaderProps = {children?: Array<any>}
type RevokedHeaderState = {expanded: boolean}
class RevokedHeader extends Component<void, RevokedHeaderProps, RevokedHeaderState> {
  state: RevokedHeaderState;

  constructor (props: Props) {
    super(props)
    this.state = {
      expanded: false,
    }
  }

  _toggleHeader (e) {
    this.setState({expanded: !this.state.expanded})
  }

  render () {
    const iconType = this.state.expanded ? 'fa-kb-iconfont-caret-down' : 'fa-kb-iconfont-caret-right'
    return (
      <Box>
        <Box style={stylesRevokedRow} onClick={e => this._toggleHeader(e)}>
          <Text type='BodySmallSemibold' style={{color: globalColors.black_60}}>Revoked devices</Text>
          <Icon type={iconType} style={{padding: 5}} />
        </Box>
        {this.state.expanded && this.props.children}
      </Box>
    )
  }
}

const DeviceRow = ({device, revoked, showRemoveDevicePage, showExistingDevicePage}) => {
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
      <Box style={{...stylesRevokedColumn}}>
        {!revoked && <Text type='BodySmallError' className='existing-device-item' onClick={e => {
          e.stopPropagation()
          showRemoveDevicePage(device)
        }}>Revoke</Text>}
      </Box>
    </Box>
  )
}

const RevokedDescription = () => (
  <Box style={stylesRevokedDescription}>
    <Text type='BodySmall' style={{color: globalColors.black_40}}>Revoked devices will no longer be able to access your Keybase account.</Text>
  </Box>
)

const RevokedDevices = ({revokedDevices, showExistingDevicePage}) => (
  <RevokedHeader>
    <RevokedDescription />
    {revokedDevices.map(device => <DeviceRow key={device.name} device={device} revoked showExistingDevicePage={showExistingDevicePage} />)}
  </RevokedHeader>
)

const DeviceHeader = ({addNewDevice, showingMenu, onHidden, menuItems}) => (
  <Box style={{...stylesCommonRow, ...globalStyles.clickable, backgroundColor: globalColors.white, height: globalMargins.xlarge}} onClick={addNewDevice}>
    <Icon type='icon-devices-add-64-x-48' />
    <Text type='BodyPrimaryLink' onClick={addNewDevice} style={{marginLeft: globalMargins.tiny}}>Add new...</Text>
    <PopupMenu style={stylesPopup} visible={showingMenu} items={menuItems} onHidden={onHidden} />
  </Box>
)

type State = {showingMenu: boolean}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      showingMenu: false,
    }
  }

  _items () {
    return [
      {title: 'New Phone', onClick: () => this.props.addNewPhone()},
      {title: 'New Computer', onClick: () => this.props.addNewComputer()},
      {title: 'New Paper Key', onClick: () => this.props.addNewPaperKey()},
    ]
  }

  render () {
    const {devices, revokedDevices, showRemoveDevicePage, showExistingDevicePage} = this.props

    const realCSS = `
    .existing-device-container .existing-device-item {
      display: none;
    }
    .existing-device-container:hover .existing-device-item {
      display: block;
    }
    `
    return (
      <Box style={stylesContainer}>
        <DeviceHeader
          menuItems={this._items()}
          addNewDevice={() => this.setState({showingMenu: true})}
          showingMenu={this.state.showingMenu}
          onHidden={() => this.setState({showingMenu: false})} />
        <style>{realCSS}</style>
        {devices && devices.map(device => <DeviceRow key={device.name} device={device} showRemoveDevicePage={showRemoveDevicePage} showExistingDevicePage={showExistingDevicePage} />)}
        {revokedDevices && <RevokedDevices revokedDevices={revokedDevices} showExistingDevicePage={showExistingDevicePage} />}
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

const stylesCommonColumn = {
  padding: 20,
}

const stylesRevokedColumn = {
  ...stylesCommonColumn,
  alignSelf: 'center',
  textAlign: 'right',
  paddingRight: 20,
}

const stylesPopup = {
  marginLeft: 'auto',
  marginRight: 'auto',
  marginTop: 50,
}

export default Render
