// @flow
import React from 'react'
import {Text, Icon, PopupMenu} from '../common-adapters'
import View from '../common-adapters/view.desktop' // TODO move to common
import Row from '../common-adapters/row.desktop' // TODO move to common
import {RowConnector} from './row'
import {globalColors} from '../styles'

import type {Props} from './'

const DeviceRow = RowConnector(({isCurrentDevice, name, isRevoked, icon, showExistingDevicePage}) => (
  <Row
    onClick={showExistingDevicePage}
    leftContent={<Icon type={icon} style={isRevoked ? {opacity: 0.2} : null} />}
    middleContent={[
      <Text key="name" style={isRevoked ? revokedName : normalName} type="BodySemibold">{name}</Text>,
      isCurrentDevice && <Text key="cur" type="BodySmall">Current device</Text>,
    ]}
  />
))

const Revoked = ({expanded, onToggleExpanded, revokedDeviceIDs}) => {
  if (!revokedDeviceIDs.length) return null

  return (
    <View onClick={onToggleExpanded}>
      <View direction="row" spacing="xtiny" padding="tiny" alignItems="center">
        <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>Revoked devices</Text>
        <Icon type={expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'} />
      </View>
      {expanded &&
        <View>
          <View center={true} direction="row" height="medium" padding="tiny">
            <Text type="BodySmall">
              Revoked devices will no longer be able to access your Keybase account.
            </Text>
          </View>
          {revokedDeviceIDs.map(id => <DeviceRow key={id} deviceID={id} isRevoked={true} />)}
        </View>}
    </View>
  )
}
const Header = ({setShowingMenu, showingMenu, deviceIDs, menuItems}) => (
  <View
    center={true}
    direction="row"
    height="large"
    onClick={() => setShowingMenu(true)}
    padding="tiny"
    spacing="tiny"
    backgroundColor={globalColors.white}
  >
    <Icon type="iconfont-new" style={{color: globalColors.blue}} />
    <Text type="BodyBigLink" onClick={() => setShowingMenu(true)}>Add new...</Text>
    {showingMenu &&
      <PopupMenu style={stylesPopup} items={menuItems} onHidden={() => setShowingMenu(false)} />}
  </View>
)

const DevicesRender = (props: Props) => (
  <View backgroundColor={globalColors.lightGrey} flexGrow={true}>
    <Header
      setShowingMenu={props.setShowingMenu}
      showingMenu={props.showingMenu}
      deviceIDs={props.deviceIDs}
      menuItems={props.menuItems}
    />
    <View scrollVertical={true}>
      <View backgroundColor={globalColors.white}>
        {props.deviceIDs.map(id => <DeviceRow key={id} deviceID={id} />)}
      </View>
      <Revoked
        expanded={props.showingRevoked}
        onToggleExpanded={props.onToggleShowRevoked}
        revokedDeviceIDs={props.revokedDeviceIDs}
      />
    </View>
  </View>
)

const normalName = {
  fontStyle: 'italic',
}

const revokedName = {
  ...normalName,
  color: globalColors.black_40,
  textDecoration: 'line-through',
}

const stylesPopup = {
  marginLeft: 'auto',
  marginRight: 'auto',
  marginTop: 50,
}

export default DevicesRender
