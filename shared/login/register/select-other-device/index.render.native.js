// @flow
import Container from '../../forms/container'
import React from 'react'
import type {DeviceType} from '../../../constants/types/more'
import type {IconType} from '../../../common-adapters/icon'
import type {Props} from './index.render'
import {Box, Text, Icon} from '../../../common-adapters'
import {TouchableHighlight, View} from 'react-native'
import {globalStyles, globalColors} from '../../../styles/style-guide'

const Row = ({deviceID, name, type, onSelect}) => {
  const iconType: IconType = ({
    'mobile': 'icon-phone-bw-48',
    'desktop': 'icon-computer-bw-48',
    'backup': 'icon-paper-key-48',
  }: {[key: DeviceType]: IconType})[type]

  const onPress = e => {
    onSelect(deviceID)
    e && e.preventDefault()
  }

  return (
    <TouchableHighlight style={stylesRow} onPress={onPress}>
      <View style={stylesIconName}>
        <View style={stylesIconContainer}>
          <Icon style={stylesIcon} type={iconType} />
        </View>
        <Text type='BodySemiboldItalic' onPress={onPress}>{name}</Text>
      </View>
    </TouchableHighlight>)
}

const Render = ({onBack, devices, onWont, onSelect}: Props) => (
  <Container
    style={stylesContainer}
    onBack={onBack}>
    <Text type='Header' style={stylesHeader}>Which device would you like to connect with?</Text>
    <Box style={stylesDevicesContainer}>
      {devices.map(d => <Row onSelect={onSelect} {...d} key={d.deviceID} />)}
    </Box>
    <Text style={stylesWont} type='BodySmallSecondaryLink' onClick={onWont}>Log in with your passphrase</Text>
  </Container>
)

const stylesContainer = {
  alignItems: 'center',
}

const stylesHeader = {
  textAlign: 'center',
  marginTop: 46,
  marginBottom: 20,
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
  alignSelf: 'center',
}

export default Render
