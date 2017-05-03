// @flow
import React from 'react'
import {Box, Text, PopupMenu, Icon, ClickableBox, ProgressIndicator, NativeScrollView, HeaderHoc} from '../common-adapters/index.native'
import {RowConnector} from './row'
import {globalStyles, globalColors, globalMargins} from '../styles'

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

const textStyle = isRevoked => (
  isRevoked
  ? {
    color: globalColors.black_40,
    flex: 0,
    textDecorationLine: 'line-through',
    textDecorationStyle: 'solid',
  }
  : {
    flex: 0,
  }
)
const _DeviceRow = ({isCurrentDevice, name, isRevoked, icon, showExistingDevicePage}) => (
  <ClickableBox onClick={showExistingDevicePage} style={{...stylesCommonRow, alignItems: 'center'}}>
    <Box key={name} style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
      <Icon type={icon} style={isRevoked ? {marginRight: 16, opacity: 0.2} : {marginRight: 16}} />
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'flex-start'}}>
        <Text style={textStyle(isRevoked)} type='BodySemiboldItalic'>{name}</Text>
        {isCurrentDevice && <Text type='BodySmall'>Current device</Text>}
      </Box>
    </Box>
  </ClickableBox>
)

const DeviceRow = RowConnector(_DeviceRow)

const DeviceHeader = ({onAddNew, waitingForServer}) => {
  if (waitingForServer) {
    return (
      <Box style={{height: 64, justifyContent: 'center'}}>
        <ProgressIndicator />
      </Box>
    )
  }
  return (
    <ClickableBox onClick={onAddNew}>
      <Box style={{...stylesCommonRow, alignItems: 'center', borderBottomWidth: 0}}>
        <Icon type='iconfont-new' style={{color: globalColors.blue, marginRight: 5}} />
        <Text type='HeaderLink' style={{padding: 5}}>Add new...</Text>
      </Box>
    </ClickableBox>
  )
}

const RevokedDescription = () => (
  <Box style={stylesRevokedDescription}>
    <Text type='BodySmallSemibold' style={{color: globalColors.black_40, paddingBottom: globalMargins.tiny, paddingTop: globalMargins.tiny, textAlign: 'center'}}>Revoked devices will no longer be able to access your Keybase account.</Text>
  </Box>
)

const DevicesRender = ({deviceIDs, revokedDeviceIDs, showingRevoked, onToggleShowRevoked, menuItems, showingMenu, setShowingMenu, waitingForServer}: Props) => (
  <Box style={stylesContainer}>
    <DeviceHeader onAddNew={() => setShowingMenu(true)} waitingForServer={waitingForServer} />
    <NativeScrollView style={{...globalStyles.flexBoxColumn, flex: 1}}>
      {deviceIDs.map(id => <DeviceRow key={id} deviceID={id} />)}
      {!!revokedDeviceIDs.length && (
        <RevokedHeader expanded={showingRevoked} onToggleExpanded={onToggleShowRevoked}>
          <RevokedDescription />
          {revokedDeviceIDs.map(id => <DeviceRow key={id} deviceID={id} />)}
        </RevokedHeader>
      )}
    </NativeScrollView>
    {showingMenu && <PopupMenu items={menuItems} onHidden={() => setShowingMenu(false)} />}
  </Box>
)

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

export default HeaderHoc(DevicesRender)
