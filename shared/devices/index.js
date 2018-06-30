// @flow
import * as Types from '../constants/types/devices'
import React, {PureComponent} from 'react'
import {
  Box2,
  Box,
  Text,
  List,
  Icon,
  ClickableBox,
  ProgressIndicator,
  HeaderOnMobile,
} from '../common-adapters'
import FloatingMenu, {
  FloatingMenuParentHOC,
  type FloatingMenuParentProps,
} from '../common-adapters/floating-menu'
import {RowConnector} from './row'
import {globalStyles, globalColors, globalMargins, isMobile, platformStyles} from '../styles'

import type {MenuItem} from '../common-adapters/popup-menu'

export type Props = {
  deviceIDs: Array<Types.DeviceID>,
  menuItems: Array<MenuItem | 'Divider' | null>,
  onToggleShowRevoked: () => void,
  revokedDeviceIDs: Array<Types.DeviceID>,
  showingRevoked: boolean,
  waiting: boolean,
}

const DeviceHeader = ({onAddNew, setAttachmentRef, waiting}) => (
  <ClickableBox onClick={onAddNew}>
    <Box ref={setAttachmentRef} style={{...stylesCommonRow, alignItems: 'center', borderBottomWidth: 0}}>
      {waiting && (
        <ProgressIndicator style={{position: 'absolute', width: 20, top: isMobile ? 22 : 14, left: 12}} />
      )}
      <Icon type="iconfont-new" color={globalColors.blue} />
      <Text type="BodyBigLink" style={{padding: globalMargins.xtiny}}>
        Add new...
      </Text>
    </Box>
  </ClickableBox>
)

const RevokedHeader = ({children, onToggleExpanded, expanded}) => (
  <Box>
    <ClickableBox onClick={onToggleExpanded}>
      <Box style={stylesRevokedRow}>
        <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>
          Revoked devices
        </Text>
        <Icon
          type={expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
          style={{padding: 5}}
          color={globalColors.black_60}
          fontSize={10}
        />
      </Box>
    </ClickableBox>
    {expanded && (
      <Box style={stylesRevokedDescription}>
        <Text
          type="BodySmallSemibold"
          style={{
            color: globalColors.black_40,
            paddingBottom: globalMargins.tiny,
            paddingTop: globalMargins.tiny,
            textAlign: 'center',
          }}
        >
          Revoked devices will no longer be able to access your Keybase account.
        </Text>
      </Box>
    )}
  </Box>
)

const DeviceRow = RowConnector(({isCurrentDevice, name, isRevoked, icon, showExistingDevicePage}) => (
  <ClickableBox onClick={showExistingDevicePage} style={{...stylesCommonRow, alignItems: 'center'}}>
    <Box key={name} style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
      <Icon type={icon} style={isRevoked ? {marginRight: 16, opacity: 0.2} : {marginRight: 16}} />
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'flex-start'}}>
        <Text style={textStyle(isRevoked)} type="BodySemiboldItalic">
          {name}
        </Text>
        {isCurrentDevice && <Text type="BodySmall">Current device</Text>}
      </Box>
    </Box>
  </ClickableBox>
))

class _Devices extends PureComponent<Props & FloatingMenuParentProps> {
  _renderRow = (index, item) =>
    item.type === 'revokedHeader' ? (
      <RevokedHeader
        key="revokedHeader"
        expanded={this.props.showingRevoked}
        onToggleExpanded={this.props.onToggleShowRevoked}
      />
    ) : (
      <DeviceRow key={item.id} deviceID={item.id} />
    )

  render() {
    const items = [
      ...this.props.deviceIDs.map(id => ({id, key: id, type: 'device'})),
      {key: 'revokedHeader', type: 'revokedHeader'},
      ...(this.props.showingRevoked
        ? this.props.revokedDeviceIDs.map(id => ({id, key: id, type: 'device'}))
        : []),
    ]

    return (
      <Box2 direction="vertical" fullHeight={true} fullWidth={true}>
        <DeviceHeader
          setAttachmentRef={this.props.setAttachmentRef}
          onAddNew={this.props.toggleShowingMenu}
          waiting={this.props.waiting}
        />
        <List items={items} renderItem={this._renderRow} />
        <FloatingMenu
          attachTo={this.props.attachmentRef}
          visible={this.props.showingMenu}
          onHidden={this.props.toggleShowingMenu}
          items={this.props.menuItems}
          position="bottom center"
        />
      </Box2>
    )
  }
}
const Devices = FloatingMenuParentHOC(_Devices)

const stylesCommonCore = {
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  justifyContent: 'center',
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  ...stylesCommonCore,
  minHeight: isMobile ? 64 : 48,
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

const textStyle = isRevoked =>
  isRevoked
    ? platformStyles({
        common: {
          color: globalColors.black_40,
          flex: 0,
          textDecorationLine: 'line-through',
          textDecorationStyle: 'solid',
        },
        isElectron: {
          fontStyle: 'italic',
        },
      })
    : {
        flex: 0,
      }

export default HeaderOnMobile(Devices)
