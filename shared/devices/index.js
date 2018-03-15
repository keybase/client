// @flow
import * as Types from '../constants/types/devices'
import React, {PureComponent} from 'react'
import {Box, Text, List, Icon, ClickableBox, ProgressIndicator, HeaderHoc} from '../common-adapters'
import {OLDPopupMenu} from '../common-adapters/popup-menu'
import {RowConnector} from './row'
import {globalStyles, globalColors, globalMargins, isMobile, platformStyles} from '../styles'
import {branch} from 'recompose'

import type {MenuItem} from '../common-adapters/popup-menu.js'

export type Props = {
  deviceIDs: Array<Types.DeviceID>,
  menuItems: Array<MenuItem | 'Divider' | null>,
  onToggleShowRevoked: () => void,
  revokedDeviceIDs: Array<Types.DeviceID>,
  showMenu: () => void,
  hideMenu: () => void,
  showingMenu: boolean,
  showingRevoked: boolean,
  waiting: boolean,
}

const DeviceHeader = ({onAddNew, waiting}) => (
  <ClickableBox onClick={onAddNew}>
    <Box style={{...stylesCommonRow, alignItems: 'center', borderBottomWidth: 0}}>
      {waiting && (
        <ProgressIndicator style={{position: 'absolute', width: 20, top: isMobile ? 22 : 14, left: 12}} />
      )}
      <Icon type="iconfont-new" style={{color: globalColors.blue}} />
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
          style={{color: globalColors.black_60, fontSize: 10, padding: 5}}
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

class Devices extends PureComponent<Props> {
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
      <Box style={stylesContainer}>
        <DeviceHeader onAddNew={this.props.showMenu} waiting={this.props.waiting} />
        <List items={items} renderItem={this._renderRow} />
        {this.props.showingMenu && (
          <OLDPopupMenu style={stylesPopup} items={this.props.menuItems} onHidden={this.props.hideMenu} />
        )}
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.fullHeight,
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

const stylesPopup = isMobile
  ? {}
  : {
      alignItems: 'center',
      left: 0,
      marginLeft: 'auto',
      marginRight: 'auto',
      marginTop: 50,
      right: 0,
      top: globalMargins.large,
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

export default branch(() => isMobile, HeaderHoc)(Devices)
