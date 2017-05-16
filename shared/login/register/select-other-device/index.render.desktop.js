// @flow
import Container from '../../forms/container.desktop'
import React from 'react'
import type {DeviceType} from '../../../constants/types/more'
import type {IconType} from '../../../common-adapters/icon'
import type {Props} from './index.render'
import {Text, Icon} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles'

const Row = ({deviceID, name, type, onSelect}) => {
  const iconType: IconType = ({
    mobile: 'icon-phone-48',
    desktop: 'icon-computer-48',
    backup: 'icon-paper-key-48',
  }: {[key: DeviceType]: IconType})[type]

  const onClick = e => {
    onSelect(deviceID)
    e && e.preventDefault()
  }

  return (
    <div style={stylesRow} onClick={onClick}>
      <div style={stylesIconName}>
        <div style={stylesIconContainer}>
          <Icon style={stylesIcon} type={iconType} />
        </div>
        <Text type="BodySemiboldItalic" onClick={onClick}>{name}</Text>
      </div>
    </div>
  )
}

const Render = ({onBack, devices, onWont, onSelect}: Props) => (
  <Container style={stylesContainer} onBack={onBack}>
    <Text type="Header" style={stylesHeader}>Which device would you like to connect with?</Text>
    <div style={stylesDevicesContainer}>
      {devices.map(d => <Row onSelect={onSelect} {...d} key={d.deviceID} />)}
    </div>
    <Text style={stylesWont} type="BodySmallSecondaryLink" onClick={onWont}>Log in with your passphrase</Text>
  </Container>
)

const stylesContainer = {}
const stylesHeader = {
  alignSelf: 'center',
  marginTop: 46,
  marginBottom: 20,
}
const stylesDevicesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  overflow: 'auto',
  width: 375,
  alignSelf: 'center',
}
const stylesRow = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.clickable,
  justifyContent: 'center',
  minHeight: 80,
  padding: 10,
  borderBottom: `solid ${globalColors.black_10} 1px`,
}
const stylesIconName = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}
const stylesIconContainer = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
  alignItems: 'center',
}
const stylesIcon = {
  color: globalColors.black,
  marginLeft: 32,
  marginRight: 22,
  maxHeight: 60,
}
const stylesWont = {
  marginTop: 10,
  alignSelf: 'center',
}

export default Render
