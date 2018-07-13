// @flow
// TODO merge this and native
// TODO remove container
import Container from '../../login/forms/container'
import * as React from 'react'
import {Box, Text, Icon, type IconType} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, desktopStyles} from '../../styles'
import glamorous from 'glamorous'
import {type DeviceType} from '../../constants/types/devices'
import {type Props} from '.'

const Row = ({name, type, onSelect}) => {
  const iconType: IconType = ({
    mobile: 'icon-phone-32',
    desktop: 'icon-computer-32',
    backup: 'icon-paper-key-32',
  }: {[key: DeviceType]: IconType})[type]

  return (
    <Box>
      <DeviceBox onClick={() => onSelect(name)}>
        <Box style={stylesIconName}>
          <Box style={stylesIconContainer}>
            <Icon style={stylesIcon} type={iconType} color={colorIcon} />
          </Box>
          <Text type="BodySemiboldItalic">{name}</Text>
        </Box>
      </DeviceBox>
    </Box>
  )
}

const ResetOption = ({onResetAccount}) => (
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
          <Icon style={stylesIcon} color={globalColors.black_40} type="iconfont-exclamation" fontSize={16} />
        </Box>
        <Box style={globalStyles.flexBoxColumn}>
          <Text type="Body">
            Uh oh. I don't have any of these devices anymore, or I've uninstalled Keybase from all of them.
            <Text
              type="BodyPrimaryLink"
              onClick={onResetAccount}
              style={{color: globalColors.red, marginLeft: 2}}
            >
              Reset account
            </Text>
          </Text>
        </Box>
      </Box>
    </DeviceBox>
  </Box>
)

const SelectOtherDevice = (props: Props) => (
  <Container style={stylesContainer} onBack={props.onBack}>
    <Text type="Header" style={stylesHeader}>
      Which Keybase install would you like to connect with?
    </Text>
    <Box style={stylesDevicesContainer}>
      {props.devices.map(d => <Row onSelect={props.onSelect} {...d} key={d.name} />)}
      <ResetOption onResetAccount={props.onResetAccount} />
    </Box>
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
  marginLeft: 32,
  marginRight: 22,
  maxHeight: 60,
}

const colorIcon = globalColors.black

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
