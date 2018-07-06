// @flow
import * as React from 'react'
import {Box2, Text, Icon, Input, WaitingButton} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins, platformStyles, styleSheetCreate} from '../../../styles'
import QRImage from './qr-image'
import QRScan from './qr-scan'

// Various pieces of text we show when provisioning.  This happens when you're on the new device or when you're on the existing device.
// If you're adding a new device we don't know the name of the other device (otherDevice)

export type DeviceType = 'phone' | 'desktop'
export type Tab = 'QR' | 'enterText' | 'viewText'

type TabDetails = {
  component: React.Node,
}

type CommonParam = {
  username: string,
  currentDeviceAlreadyProvisioned: boolean,
  currentDeviceType: DeviceType,
  currentDeviceName: string,
  otherDeviceName: string,
  otherDeviceType: DeviceType,
}

type Options = {
  defaultTab: Tab,
  // validTabs: Array<Tab>,
  tabDetails: {[tab: Tab]: TabDetails},
  // enterTextCodeInputHint: React.Node,
  // enterTextCodeInstructions: React.Node,
  // enterQrCodeInstructions: React.Node,
  // viewTextCodeInstructions: React.Node,
  // viewQrCodeInstructions: React.Node,
}

// const howToGetTextCodeOnExistingDevice = p => (
// <Box2 direction="vertical">
// <Text type="Body">
// • Launch Keybase on <Text type="BodySemiboldItalic">{p.otherDeviceName}</Text>
// </Text>
// <Text type="Body">
// • Go to {p.otherDeviceType === 'phone' ? 'Settings > ' : ''}Devices > Add new... and choose{' '}
// <Text type="BodySemiboldItalic">New {p.currentDeviceType}</Text>
// </Text>
// <Text type="Body">
// • Select the <Text type="BodySemiboldItalic">See a text code</Text> tab and enter that code below
// </Text>
// </Box2>
// )
// const howToGetTextCodeOnNewDevice = p => (
// <Box2 direction="vertical">
// <Text type="Body">
// • Launch Keybase on your new {p.otherDeviceType} and log in as{' '}
// <Text type="BodySemiboldItalic">{p.username}</Text>
// </Text>
// <Text type="Body">
// • Select a name for your new {p.otherDeviceType} and choose{' '}
// <Text type="BodySemiboldItalic">{p.currentDeviceName}</Text> to provision with
// </Text>
// <Text type="Body">
// • Select the <Text type="BodySemiboldItalic">See a text code</Text> tab and enter that code below
// </Text>
// </Box2>
// )

// const howToEnterTextCodeOnExistingDevice = p => (
// <Box2 direction="vertical">
// <Text type="Body">
// • Launch Keybase on <Text type="BodySemiboldItalic">{p.otherDeviceName}</Text>
// </Text>
// <Text type="Body">
// • Go to {p.otherDeviceType === 'phone' ? 'Settings > ' : ''}Devices > Add new... and choose{' '}
// <Text type="BodySemiboldItalic">New {p.currentDeviceType}</Text>
// </Text>
// <Text type="Body">
// • Select the <Text type="BodySemiboldItalic">Enter a text code</Text> tab and type this code in:
// </Text>
// </Box2>
// )
// const howToEnterTextCodeOnNewDevice = p => (
// <Box2 direction="vertical">
// <Text type="Body">
// • Launch Keybase on your new {p.otherDeviceType} and log in as{' '}
// <Text type="BodySemiboldItalic">{p.username}</Text>
// </Text>
// <Text type="Body">
// • Select a name for your new {p.otherDeviceType} and choose{' '}
// <Text type="BodySemiboldItalic">{p.currentDeviceName}</Text> to provision with
// </Text>
// <Text type="Body">
// • Select the <Text type="BodySemiboldItalic">Enter a text code</Text> tab and type this code in:
// </Text>
// </Box2>
// )

// const howToViewQRCodeOnNewDevice = p => (
// )
// const howToScanQRCodeOnExistingDevice = p => <Text type="Body">TODO</Text>
// const howToScanQRCodeOnNewDevice = p => (
// <Box2 direction="vertical">
// <Text type="Body">
// In <Text type="BodySemiboldItalic">{p.otherDeviceName}</Text>, go to Devices > Add new > New phone.
// </Text>
// </Box2>
// )
// const howToViewQRCodeOnExistingDevice = p => null

const defaultTab = p => {
  const oppositeTabMap = {
    enterText: 'viewText',
    scanQR: 'viewQR',
    viewQR: 'scanQR',
    viewText: 'enterText',
  }
  const getTabOrOpposite = tabToShowToNew =>
    p.currentDeviceAlreadyProvisioned ? oppositeTabMap[tabToShowToNew] : tabToShowToNew

  if (p.currentDeviceType === 'phone') {
    return getTabOrOpposite('viewQR')
  } else if (p.currentDeviceType === 'desktop') {
    return p.otherDeviceType === 'desktop' ? getTabOrOpposite('viewText') : getTabOrOpposite('scanQR')
  }

  throw new Error('Impossible defaultTab')
}

const validTabs = p => {
  if (p.currentDeviceType === 'desktop' && p.otherDeviceType === 'desktop') {
    return ['viewText', 'enterText']
  } else {
    return ['viewQR', 'scanQR', 'viewText', 'enterText']
  }
}

// const enterTextCodeInputHintForNewDevice = p => `Text code from device: '${p.otherDeviceName || 'unknown'}'`
// const enterTextCodeInputHintForExistingDevice = p => `Text code from your new ${p.otherDeviceType}`

const PanelContainer = ({instructions, children}) => (
  <Box2 direction="vertical" style={styles.panelContainer} gap="medium" gapStart={true}>
    {instructions}
    {children}
  </Box2>
)

// const ViewText = ({code, instructions}) => (
// <PanelContainer instructions={instructions}>
// <Text type="Terminal" style={styles.textCode}>
// {code}
// </Text>
// </PanelContainer>
// )

// class EnterText extends React.Component<
// {
// isValidLookingCode: string => boolean,
// onSubmit: string => void,
// instructions: React.Node,
// inputHint: string,
// },
// {value: string, canSubmit: boolean}
// > {
// state = {canSubmit: false, value: ''}
// _onSubmit = () => this.props.onSubmit(this.state.value)
// _updateValue = value => this.setState({canSubmit: this.props.isValidLookingCode(value), value})
// render() {
// return (
// <PanelContainer instructions={this.props.instructions}>
// <Input
// uncontrolled={true}
// onEnterKeyDown={this._onSubmit}
// onChangeText={this._updateValue}
// hintText={this.props.inputHint}
// />
// <WaitingButton
// type="Primary"
// label="Continue"
// onClick={this._onSubmit}
// disabled={!this.state.canSubmit}
// waitingKey="TODO"
// />
// </PanelContainer>
// )
// }
// }

const QR = (p: CommonParam) => {
  const instructions = (
    <Box2 direction="vertical">
      {p.currentDeviceAlreadyProvisioned ? (
        <Text type="Body">
          In <Text type="BodySemiboldItalic">{p.otherDeviceName}</Text>, go to Devices > Add new > New phone.
        </Text>
      ) : (
        <Text type="Body">
          Ready to provision using <Text type="BodySemiboldItalic">{p.otherDeviceName}</Text>
        </Text>
      )}
    </Box2>
  )
  return (
    <PanelContainer instructions={instructions}>
      <QRImage url={p.url} />
      <QRScan onScan={p.onScan} />
    </PanelContainer>
  )
}

const tabDetails = (p: CommonParam): {[tab: Tab]: TabDetails} => {
  if (p.currentDeviceAlreadyProvisioned) {
    if (p.otherDeviceType === 'phone') {
      return {
        QR: (
          <Box2 direction="vertical">
            <Text type="Body">
              In <Text type="BodySemiboldItalic">{p.otherDeviceName}</Text>, go to Devices > Add new > New
              phone.
            </Text>
          </Box2>
        ),
      }
      if (p.currentDeviceType === 'phone') {
      } else {
      }
    } else {
      if (p.otherDeviceType === 'phone') {
        return {QR: <QR {...p} />}
      }
    }
  }
}

export const getOptions = (p: CommonParam): Options => {
  return {
    defaultTab: defaultTab(p),
    // enterQrCodeInstructions: p.currentDeviceAlreadyProvisioned
    // ? howToViewQRCodeOnNewDevice(p)
    // : howToViewQRCodeOnExistingDevice(p),
    // enterTextCodeInputHint: p.currentDeviceAlreadyProvisioned
    // ? enterTextCodeInputHintForNewDevice(p)
    // : enterTextCodeInputHintForExistingDevice(p),
    // enterTextCodeInstructions: p.currentDeviceAlreadyProvisioned
    // ? howToGetTextCodeOnNewDevice(p)
    // : howToGetTextCodeOnExistingDevice(p),
    validTabs: validTabs(p),
    tabDetails: tabDetails(p),
    // viewTextCodeInstructions: p.currentDeviceAlreadyProvisioned
    // ? howToEnterTextCodeOnNewDevice(p)
    // : howToEnterTextCodeOnExistingDevice(p),
    // viewQrCodeInstructions: p.currentDeviceAlreadyProvisioned
    // ? howToScanQRCodeOnNewDevice(p)
    // : howToScanQRCodeOnExistingDevice(p),
  }
}

const styles = styleSheetCreate({
  panelContainer: {
    alignItems: 'center',
  },
  tabs: {
    padding: globalMargins.small,
  },
  textCode: {
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 1,
    color: globalColors.darkBlue,
    maxWidth: 300,
    padding: 20,
    textAlign: 'center',
  },
})
