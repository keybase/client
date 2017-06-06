// @flow
import Container from '../../forms/container'
import React from 'react'
import type {DeviceType} from '../../../constants/types/more'
import type {IconType} from '../../../common-adapters/icon'
import type {Props} from './index.render'
import {Box, Text, Icon, ClickableBox, NativeScrollView, Button} from '../../../common-adapters/index.native'
import {globalColors, globalMargins, globalStyles} from '../../../styles'

const Row = ({deviceID, name, type, onSelect}) => {
  const iconType: IconType = ({
    mobile: 'icon-phone-48',
    desktop: 'icon-computer-48',
    backup: 'icon-paper-key-48',
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
        <Box style={{...globalStyles.flexBoxColumn}}>
          <Text type="BodySemiboldItalic" onClick={onPress}>{name}</Text>
          {type === 'backup' && <Text type="BodySmall">Paper key</Text>}
        </Box>
        <Box style={stylesButtonContainer}>
          <Button label="Use..." type="Secondary" small={true} onClick={onPress} />
        </Box>
      </Box>
    </ClickableBox>
  )
}

const Render = ({onBack, devices, onWont, onSelect}: Props) => (
  <Container style={stylesContainer} onBack={onBack}>
    <Box style={globalStyles.flexBoxColumn}>
      <Text type="Header" style={stylesInstructions}>Please prove you're you</Text>
      <Text type="Body" style={stylesInstructions}>
        Which of your other devices do you have handy?
      </Text>
    </Box>
    <NativeScrollView style={stylesDevicesContainer}>
      {devices.map(d => <Row onSelect={onSelect} {...d} key={d.deviceID} />)}
    </NativeScrollView>
    <Text style={stylesWont} type="BodySmallSecondaryLink" onClick={onWont}>Log in with your passphrase</Text>
  </Container>
)
const stylesContainer = {
  alignItems: 'center',
}
const stylesInstructions = {
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
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  alignItems: 'center',
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  paddingTop: globalMargins.tiny,
  borderBottomWidth: 1,
  borderBottomColor: globalColors.black_05,
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
  marginLeft: 0,
  marginRight: globalMargins.small,
}
const stylesButtonContainer = {
  ...globalStyles.flexBoxRow,
  flexGrow: 1,
  justifyContent: 'flex-end',
}

const stylesWont = {
  marginTop: globalMargins.medium,
  marginBottom: globalMargins.medium,
  alignSelf: 'center',
}

export default Render
