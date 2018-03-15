// @flow
import Container from '../../forms/container'
import * as React from 'react'
import {Box, Text, Icon, ClickableBox, NativeScrollView, Button} from '../../../common-adapters/index.native'
import {globalColors, globalMargins, globalStyles} from '../../../styles'

import type {DeviceType} from '../../../constants/types/devices'
import type {IconType} from '../../../common-adapters/icon'
import type {Props} from '.'

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
        <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
          <Text type="BodySemiboldItalic" onClick={onPress}>
            {name}
          </Text>
          {type === 'backup' && <Text type="BodySmall">Paper key</Text>}
        </Box>
        <Button label="Use..." type="Secondary" small={true} onClick={onPress} />
      </Box>
    </ClickableBox>
  )
}

const ResetOption = ({onReset}) => (
  <Box>
    <Box style={stylesRow} className="deviceRow">
      <Box style={stylesIconName}>
        <Box
          style={{
            ...stylesIconContainer,
            alignSelf: 'flex-start',
            width: 48,
            marginRight: globalMargins.small,
            marginTop: globalMargins.tiny,
          }}
        >
          <Icon
            style={{
              ...stylesIcon,
              fontSize: 24,
              color: globalColors.black_40,
              marginRight: 0,
            }}
            type="iconfont-exclamation"
          />
        </Box>
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            flex: 1,
            alignItems: 'flex-start',
            paddingBottom: globalMargins.tiny,
            paddingTop: globalMargins.tiny,
          }}
        >
          <Text type="Body">
            Uh oh. I don't have any of these devices anymore, or I've uninstalled Keybase from all of them.
          </Text>
          <Text
            type="BodyPrimaryLink"
            onClick={onReset}
            style={{
              color: globalColors.red,
              paddingBottom: globalMargins.tiny,
              paddingTop: globalMargins.tiny,
            }}
          >
            Reset account
          </Text>
        </Box>
      </Box>
    </Box>
  </Box>
)

const SelectOtherDevice = ({onBack, devices, onWont, onSelect, canSelectNoDevice, onReset}: Props) => (
  <Container style={stylesContainer} onBack={onBack} outerStyle={{paddingLeft: 0, paddingRight: 0}}>
    <Box style={globalStyles.flexBoxColumn}>
      <Text type="Header" style={stylesInstructions}>
        Please prove you're you
      </Text>
      <Text type="Body" style={stylesInstructions}>
        Which of your other devices do you have handy?
      </Text>
    </Box>
    <NativeScrollView style={stylesDevicesContainer}>
      {devices.map(d => <Row onSelect={onSelect} {...d} key={d.deviceID} />)}
      <ResetOption onReset={onReset} />
    </NativeScrollView>
    {canSelectNoDevice && (
      <Text style={stylesWont} type="BodySmallSecondaryLink" onClick={onWont}>
        Log in with your passphrase
      </Text>
    )}
  </Container>
)
const stylesContainer = {
  alignItems: 'center',
  width: '100%',
}
const stylesInstructions = {
  marginBottom: globalMargins.small,
  textAlign: 'center',
}
const stylesDevicesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  alignSelf: 'center',
  width: '100%',
}
const stylesRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  paddingTop: globalMargins.tiny,
  borderBottomWidth: 1,
  borderBottomColor: globalColors.black_05,
  width: '100%',
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
const stylesWont = {
  marginTop: globalMargins.medium,
  marginBottom: globalMargins.medium,
  alignSelf: 'center',
}

export default SelectOtherDevice
