// @flow
import React, {Component} from 'react'
import {Box, Text, PopupMenu, Icon, ClickableBox, NativeScrollView} from '../common-adapters/index.native'
import {RowConnector} from './row'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {IconType} from '../common-adapters/icon'
import type {Props} from '.'

type RevokedHeaderProps = {children?: Array<any>, onToggleExpanded: () => void, expanded: boolean}

const RevokedHeader = (props: RevokedHeaderProps) => (
  <Box>
    <ClickableBox onClick={props.onToggleExpanded}>
      <Box style={stylesRevokedRow}>
        <Text
          type='BodySmallSemibold'
          style={{color: globalColors.black_60}}>Revoked devices</Text>
        <Icon
          type={props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
          style={{color: globalColors.black_60, fontSize: 10, padding: 5}} />
      </Box>
    </ClickableBox>
    {props.expanded && props.children}
  </Box>
)

const _DeviceRow = ({device, showExistingDevicePage}) => {
  const revoked = !!device.revokeBy

  const icon: IconType = {
    'backup': 'icon-paper-key-48',
    'desktop': 'icon-computer-48',
    'mobile': 'icon-phone-48',
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

const DeviceRow = RowConnector(_DeviceRow)

const DeviceHeader = ({onAddNew}) => (
  <ClickableBox onClick={onAddNew}>
    <Box style={{...stylesCommonRow, alignItems: 'center', borderBottomWidth: 0}}>
      <Icon type='iconfont-new' style={{color: globalColors.blue, marginRight: 5}} />
      <Text type='HeaderLink' style={{padding: 5}}>Add new...</Text>
    </Box>
  </ClickableBox>
)

const RevokedDescription = () => (
  <Box style={stylesRevokedDescription}>
    <Text type='BodySmallSemibold' style={{color: globalColors.black_40, textAlign: 'center', paddingTop: globalMargins.tiny, paddingBottom: globalMargins.tiny}}>Revoked devices will no longer be able to access your Keybase account.</Text>
  </Box>
)

class DevicesRender extends Component<void, Props, {showingMenu: boolean}> {
  state = {
    showingMenu: false,
  }

  render () {
    const menuItems = [
      {onClick: this.props.addNewPhone, title: 'New Phone'},
      {onClick: this.props.addNewComputer, title: 'New Computer'},
      {onClick: this.props.addNewPaperKey, title: 'New Paper Key'},
    ]

    const {deviceIDs, revokedDeviceIDs, showingRevoked, onToggleShowRevoked} = this.props
    return (
      <Box style={stylesContainer}>
        <DeviceHeader onAddNew={() => this.setState({showingMenu: true})} />
        <NativeScrollView style={{...globalStyles.flexBoxColumn, flex: 1}}>
          {deviceIDs.map(id => <DeviceRow key={id} device={id} />)}
          {revokedDeviceIDs.length && (
            <RevokedHeader expanded={showingRevoked} onToggleExpanded={onToggleShowRevoked}>
              <RevokedDescription />
              {revokedDeviceIDs.map(id => <DeviceRow key={id} deviceID={id} />)}
            </RevokedHeader>
          )}
        </NativeScrollView>
        {this.state.menuVisible && <PopupMenu items={menuItems} onHidden={() => this.setState({showingMenu: false})} />}
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const stylesCommonCore = {
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  justifyContent: 'center',
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  ...stylesCommonCore,
  minHeight: 64,
  padding: 8,
}

const stylesRevokedRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'flex-start',
  minHeight: 38,
  paddingLeft: 8,
}

const stylesRevokedDescription = {
  ...globalStyles.flexBoxColumn,
  ...stylesCommonCore,
  alignItems: 'center',
  paddingLeft: 32,
  paddingRight: 32,
}

export default DevicesRender
