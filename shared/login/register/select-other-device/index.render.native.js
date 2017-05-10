// @flow
import Container from '../../forms/container'
import React from 'react'
import type {DeviceType} from '../../../constants/types/more'
import type {IconType} from '../../../common-adapters/icon'
import type {Props} from './index.render'
import {Box, Text, Icon, ClickableBox, NativeScrollView} from '../../../common-adapters/index.native'
import {globalColors, globalMargins, globalStyles} from '../../../styles'

const Row = ({deviceID, name, type, onSelect}) => {
  const iconType: IconType = ({
    'mobile': 'icon-phone-48',
    'desktop': 'icon-computer-48',
    'backup': 'icon-paper-key-48',
  }: {[key: DeviceType]: IconType})[type]

  const onPress = e => {
    onSelect(deviceID)
    e && e.preventDefault()
  }

  return (
    <ClickableBox style={stylesRow} onClick={onPress}>
      <Box style={stylesIconName}>
        <Box style={stylesIconContainer}>
          <Icon style={stylesIcon} type={iconType} />
        </Box>
        <Text type='BodySemiboldItalic' onClick={onPress}>{name}</Text>
      </Box>
    </ClickableBox>)
}

const Render = ({onBack, devices, onWont, onSelect}: Props) => (
  <Container
    style={stylesContainer}
    onBack={onBack}>
    <Text type='Header' style={stylesHeader}>Which device would you like to connect with?</Text>
    <NativeScrollView style={stylesDevicesContainer}>
      {devices.map(d => <Row onSelect={onSelect} {...d} key={d.deviceID} />)}
    </NativeScrollView>
    <Text style={stylesWont} type='BodySmallSecondaryLink' onClick={onWont}>Log in with your passphrase</Text>
  </Container>
)

const stylesContainer = {
  alignItems: 'center',
}
const stylesHeader = {
  marginBottom: globalMargins.small,
  textAlign: 'center',
}
const stylesDevicesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  width: 375,
  alignSelf: 'center',
}
const stylesRow = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.clickable,
  justifyContent: 'center',
  padding: 10,
  borderBottomWidth: 1,
  borderBottomColor: globalColors.black_10,
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
}
const stylesWont = {
  marginTop: 10,
  marginBottom: 10,
  alignSelf: 'center',
}

export default Render
