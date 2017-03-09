// @flow
import React, {Component} from 'react'
import {Box, Text, PopupMenu, Icon, ClickableBox, NativeScrollView} from '../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {IconType} from '../common-adapters/icon'
import type {Props} from '.'

const DeviceRow = ({device, revoked, showRemoveDevicePage, showExistingDevicePage}) => {
  const icon: IconType = {
    'mobile': 'icon-phone-48',
    'desktop': 'icon-computer-48',
    'backup': 'icon-paper-key-48',
  }[device.type]

  let textStyle = {flex: 0}
  if (revoked) {
    textStyle = {
      ...textStyle,
      color: globalColors.black_40,
      textDecorationLine: 'line-through',
      textDecorationStyle: 'solid',
    }
  }

  return (
    <ClickableBox onClick={() => showExistingDevicePage(device)} style={{...stylesCommonRow, alignItems: 'center'}}>
      <Box key={device.name} style={{...globalStyles.flexBoxRow, flex: 1, alignItems: 'center'}}>
        <Icon type={icon} style={revoked ? {marginRight: 16, opacity: 0.2} : {marginRight: 16}} />
        <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'flex-start', flex: 1}}>
          <Text style={textStyle} type='BodySemiboldItalic'>{device.name}</Text>
          {device.currentDevice && <Text type='BodySmall'>Current device</Text>}
        </Box>
      </Box>
    </ClickableBox>
  )
}

const RevokedDescription = () => (
  <Box style={stylesRevokedDescription}>
    <Text type='BodySmallSemibold' style={{color: globalColors.black_40, textAlign: 'center', paddingTop: globalMargins.tiny, paddingBottom: globalMargins.tiny}}>Revoked devices will no longer be able to access your Keybase account.</Text>
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
        <ClickableBox onClick={e => this._toggleHeader(e)}>
          <Box style={stylesRevokedRow}>
            <Text type='BodySmallSemibold' style={{color: globalColors.black_60}}>Revoked devices</Text>
            <Icon type={iconType} style={{padding: 5, fontSize: 10, color: globalColors.black_60}} />
          </Box>
        </ClickableBox>
        <Box>
          {this.state.expanded && <RevokedDescription />}
          {this.state.expanded && this.props.revokedDevices.map(device => <DeviceRow key={device.name} device={device} revoked={true} />)}
        </Box>
      </Box>)
  }
}

const DeviceHeader = ({onAddNew}) => (
  <ClickableBox onClick={onAddNew}>
    <Box style={{...stylesCommonRow, alignItems: 'center', borderBottomWidth: 0}}>
      <Icon type='iconfont-new' style={{color: globalColors.blue, marginRight: 5}} />
      <Text type='HeaderLink' style={{padding: 5}}>Add new...</Text>
    </Box>
  </ClickableBox>
)

type State = {
  menuVisible: boolean,
}
class DevicesRender extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {menuVisible: false}
  }

  render () {
    const items = [
      {title: 'New Phone', onClick: () => this.props.addNewPhone()},
      {title: 'New Computer', onClick: () => this.props.addNewComputer()},
      {title: 'New Paper Key', onClick: () => this.props.addNewPaperKey()},
    ]
    return (
      <Box style={stylesContainer}>
        <DeviceHeader onAddNew={() => this.setState({menuVisible: true})} />
        <NativeScrollView style={{...globalStyles.flexBoxColumn, flex: 1}}>
          {this.props.devices && this.props.devices.map(device =>
            <DeviceRow
              key={device.name}
              device={device}
              showRemoveDevicePage={this.props.showRemoveDevicePage}
              showExistingDevicePage={this.props.showExistingDevicePage} />)}
          <RevokedDevices revokedDevices={this.props.revokedDevices} />
        </NativeScrollView>
        {this.state.menuVisible && <PopupMenu items={items} onHidden={() => this.setState({menuVisible: false})} />}
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const stylesCommonCore = {
  borderBottomColor: globalColors.black_05,
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
}

const stylesRevokedDescription = {
  ...globalStyles.flexBoxColumn,
  ...stylesCommonCore,
  alignItems: 'center',
  paddingLeft: 32,
  paddingRight: 32,
}

export default DevicesRender
