// @flow
import Container from '../../forms/container.desktop'
import * as React from 'react'
import {Box, Text, Icon} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins, desktopStyles} from '../../../styles'
import glamorous from 'glamorous'
import {type DeviceType} from '../../../constants/types/devices'
import {type IconType} from '../../../common-adapters/icon'
import {type Props} from '.'

const Row = ({deviceID, name, type, onSelect}) => {
  const iconType: IconType = ({
    mobile: 'icon-phone-32',
    desktop: 'icon-computer-32',
    backup: 'icon-paper-key-32',
  }: {[key: DeviceType]: IconType})[type]

  const onClick = e => {
    onSelect(deviceID)
    e && e.preventDefault()
  }

  return (
    <Box>
      <DeviceBox onClick={onClick}>
        <Box style={stylesIconName}>
          <Box style={stylesIconContainer}>
            <Icon style={stylesIcon} type={iconType} />
          </Box>
          <Text type="BodySemiboldItalic" onClick={onClick}>
            {name}
          </Text>
        </Box>
      </DeviceBox>
    </Box>
  )
}

const ResetOption = ({onReset}) => (
  <Box>
    <DeviceBox>
      <Box style={stylesIconName}>
        <Box
          style={{
            ...stylesIconContainer,
            width: 160,
            marginTop: globalMargins.tiny,
            alignSelf: 'flex-start',
          }}
        >
          <Icon
            style={{
              ...stylesIcon,
              fontSize: 16,
              color: globalColors.black_40,
            }}
            type="iconfont-exclamation"
          />
        </Box>
        <Box style={globalStyles.flexBoxColumn}>
          <Text type="Body">
            Uh oh. I don't have any of these devices anymore, or I've uninstalled Keybase from all of them.
            <Text type="BodyPrimaryLink" onClick={onReset} style={{color: globalColors.red, marginLeft: 2}}>
              Reset account
            </Text>
          </Text>
        </Box>
      </Box>
    </DeviceBox>
  </Box>
)

const SelectOtherDevice = ({onBack, devices, onWont, onSelect, canSelectNoDevice, onReset}: Props) => (
  <Container style={stylesContainer} onBack={onBack}>
    <Text type="Header" style={stylesHeader}>
      Which Keybase install would you like to connect with?
    </Text>
    <Box style={stylesDevicesContainer}>
      {devices.map(d => <Row onSelect={onSelect} {...d} key={d.deviceID} />)}
      <ResetOption onReset={onReset} />
    </Box>
    {canSelectNoDevice && (
      <Text style={stylesWont} type="BodySmallSecondaryLink" onClick={onWont}>
        Log in with your passphrase
      </Text>
    )}
  </Container>
)

const stylesContainer = {}
const stylesHeader = {
  alignSelf: 'center',
  marginBottom: globalMargins.large,
  marginTop: globalMargins.large,
}
const stylesDevicesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  overflow: 'auto',
  width: 460,
  alignSelf: 'center',
}
const stylesRow = {
  ...globalStyles.flexBoxColumn,
  ...desktopStyles.clickable,
  borderRadius: 4,
  justifyContent: 'center',
  minHeight: 32,
  padding: globalMargins.tiny,
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
  marginTop: globalMargins.medium,
  alignSelf: 'center',
}

const DeviceBox = glamorous(Box)({
  ...stylesRow,
  borderBottom: `1px solid ${globalColors.black_05}`,
  ':hover': {
    backgroundColor: globalColors.blue4,
    borderBottom: `1px solid ${globalColors.blue4}`,
  },
})

export default SelectOtherDevice
