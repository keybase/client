// @flow
import React, {PureComponent} from 'react'
import {Box, Text, List, Icon, ClickableBox, ProgressIndicator, HeaderHoc} from '../common-adapters'
import {OLDPopupMenu} from '../common-adapters/popup-menu'
import {RowConnector} from './row'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {isMobile} from '../constants/platform'
import {branch} from 'recompose'

import type {Device} from '../constants/types/flow-types'
import type {MenuItem} from '../common-adapters/popup-menu.js'

type Props = {
  deviceIDs: Array<string>,
  menuItems: Array<MenuItem | 'Divider' | null>,
  onToggleShowRevoked: () => void,
  revokedDeviceIDs: Array<string>,
  showMenu: () => void,
  hideMenu: () => void,
  showExistingDevicePage: (device: Device) => void,
  showRemoveDevicePage: (device: Device) => void,
  showingMenu: boolean,
  showingRevoked: boolean,
  waitingForServer: boolean,
}

const DeviceHeader = ({onAddNew}) => {
  return (
    <ClickableBox onClick={onAddNew}>
      <Box style={{...stylesCommonRow, alignItems: 'center', borderBottomWidth: 0}}>
        <Icon type="iconfont-new" style={{color: globalColors.blue}} />
        <Text type="BodyBigLink" style={{padding: globalMargins.xtiny}}>Add new...</Text>
      </Box>
    </ClickableBox>
  )
}

const RevokedHeader = ({children, onToggleExpanded, expanded}) => (
  <Box>
    <ClickableBox onClick={onToggleExpanded}>
      <Box style={stylesRevokedRow}>
        <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>Revoked devices</Text>
        <Icon
          type={expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
          style={{color: globalColors.black_60, fontSize: 10, padding: 5}}
        />
      </Box>
    </ClickableBox>
    {expanded &&
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
      </Box>}
  </Box>
)

const DeviceRow = RowConnector(({isCurrentDevice, name, isRevoked, icon, showExistingDevicePage}) => (
  <ClickableBox onClick={showExistingDevicePage} style={{...stylesCommonRow, alignItems: 'center'}}>
    <Box key={name} style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
      <Icon type={icon} style={isRevoked ? {marginRight: 16, opacity: 0.2} : {marginRight: 16}} />
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'flex-start'}}>
        <Text style={textStyle(isRevoked)} type="BodySemiboldItalic">{name}</Text>
        {isCurrentDevice && <Text type="BodySmall">Current device</Text>}
      </Box>
    </Box>
  </ClickableBox>
))

class Devices extends PureComponent<Props> {
  _renderRow = (index, item) => {
    if (item.type === 'revokedHeader') {
      return (
        <RevokedHeader
          key="revokedHeader"
          expanded={this.props.showingRevoked}
          onToggleExpanded={this.props.onToggleShowRevoked}
        />
      )
    }

    return <DeviceRow key={item.id} deviceID={item.id} />
  }

  render() {
    if (this.props.waitingForServer) {
      return (
        <Box style={{...globalStyles.flexBoxRow, height: 64, justifyContent: 'center'}}>
          <ProgressIndicator style={{alignSelf: 'center', width: 24}} />
        </Box>
      )
    }
    return (
      <Box style={stylesContainer}>
        <DeviceHeader onAddNew={this.props.showMenu} />
        <List
          items={[
            ...this.props.deviceIDs.map(id => ({type: 'device', key: id, id})),
            {type: 'revokedHeader', key: 'revokedHeader'},
            ...(this.props.showingRevoked
              ? this.props.revokedDeviceIDs.map(id => ({type: 'device', key: id, id}))
              : []),
          ]}
          renderItem={this._renderRow}
        />
        {this.props.showingMenu &&
          <OLDPopupMenu style={stylesPopup} items={this.props.menuItems} onHidden={this.props.hideMenu} />}
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
      top: globalMargins.large,
      alignItems: 'center',
      left: 0,
      right: 0,
      marginLeft: 'auto',
      marginRight: 'auto',
      marginTop: 50,
    }

const textStyle = isRevoked =>
  isRevoked
    ? {
        color: globalColors.black_40,
        flex: 0,
        ...(isMobile
          ? {
              textDecorationLine: 'line-through',
              textDecorationStyle: 'solid',
            }
          : {
              fontStyle: 'italic',
              textDecoration: 'line-through',
            }),
      }
    : {
        flex: 0,
      }

export default branch(() => isMobile, HeaderHoc)(Devices)
