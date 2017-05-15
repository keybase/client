// @flow
import React from 'react'
import {Box, Text, Icon, PopupMenu} from '../common-adapters'
import {RowConnector} from './row'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props} from './'

type RevokedHeaderProps = {children?: Array<any>, onToggleExpanded: () => void, expanded: boolean}

const RevokedHeader = (props: RevokedHeaderProps) => (
  <Box>
    <Box style={stylesRevokedRow} onClick={props.onToggleExpanded}>
      <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>Revoked devices</Text>
      <Icon
        type={props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
        style={{padding: globalMargins.xtiny}}
      />
    </Box>
    {props.expanded && props.children}
  </Box>
)

const textStyle = isRevoked =>
  isRevoked
    ? {
        color: globalColors.black_40,
        fontStyle: 'italic',
        textDecoration: 'line-through',
      }
    : {
        fontStyle: 'italic',
      }

const _DeviceRow = ({isCurrentDevice, name, isRevoked, icon, showExistingDevicePage}) => (
  <Box
    className="existing-device-container"
    key={name}
    onClick={showExistingDevicePage}
    style={{...stylesCommonRow, borderBottom: `1px solid ${globalColors.black_05}`}}
  >
    <Box style={isRevoked ? {opacity: 0.2} : {}}>
      <Icon type={icon} />
    </Box>
    <Box style={{flex: 1, marginLeft: globalMargins.small}}>
      <Box style={{...globalStyles.flexBoxRow}}>
        <Text style={textStyle(isRevoked)} type="BodySemibold">{name}</Text>
      </Box>
      <Box style={{...globalStyles.flexBoxRow}}>
        {isCurrentDevice && <Text type="BodySmall">Current device</Text>}
      </Box>
    </Box>
  </Box>
)

const DeviceRow = RowConnector(_DeviceRow)

const RevokedDescription = () => (
  <Box style={stylesRevokedDescription}>
    <Text type="BodySmall" style={{color: globalColors.black_40}}>
      Revoked devices will no longer be able to access your Keybase account.
    </Text>
  </Box>
)

const DeviceHeader = ({addNewDevice, showingMenu, onHidden, menuItems}) => (
  <Box
    style={{...stylesCommonRow, ...globalStyles.clickable, backgroundColor: globalColors.white, height: 48}}
    onClick={addNewDevice}
  >
    <Icon type="iconfont-new" style={{color: globalColors.blue}} />
    <Text type="BodyBigLink" onClick={addNewDevice} style={{marginLeft: globalMargins.tiny}}>Add new...</Text>
    {showingMenu && <PopupMenu style={stylesPopup} items={menuItems} onHidden={onHidden} />}
  </Box>
)

const DevicesRender = ({
  deviceIDs,
  revokedDeviceIDs,
  showingRevoked,
  onToggleShowRevoked,
  menuItems,
  showingMenu,
  setShowingMenu,
}: Props) => (
  <Box style={stylesContainer}>
    <DeviceHeader
      menuItems={menuItems}
      addNewDevice={() => setShowingMenu(true)}
      showingMenu={showingMenu}
      onHidden={() => setShowingMenu(false)}
    />
    {deviceIDs.map(id => <DeviceRow key={id} deviceID={id} />)}
    {!!revokedDeviceIDs.length &&
      <RevokedHeader expanded={showingRevoked} onToggleExpanded={onToggleShowRevoked}>
        <RevokedDescription />
        {revokedDeviceIDs.map(id => <DeviceRow key={id} deviceID={id} />)}
      </RevokedHeader>}
  </Box>
)

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
