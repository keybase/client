// @flow
import * as React from 'react'
import {Box2, Text, Icon, Input, WaitingButton} from '../../../common-adapters'
import {
  globalStyles,
  globalColors,
  globalMargins,
  platformStyles,
  styleSheetCreate,
  collapseStyles,
} from '../../../styles'
import QRImage from './qr-image'
import QRScan from './qr-scan'
// import {qrGenerate} from '../../../constants/login'
// import type {Tab, DeviceType} from './helper'

export type DeviceType = 'phone' | 'desktop'
export type Tab = 'QR' | 'enterText' | 'viewText'

// type TabDetails = {
// component: React.Node,
// }

type Props = {
  username: string,
  currentDeviceAlreadyProvisioned: boolean,
  currentDeviceType: DeviceType,
  currentDeviceName: string,
  otherDeviceName: string,
  otherDeviceType: DeviceType,
  textCode: string,
  QRUrl: string,
  onSubmitTextCode: string => void,
}

// type Options = {
// defaultTab: Tab,
// // validTabs: Array<Tab>,
// tabDetails: {[tab: Tab]: TabDetails},
// }

// type Props = {
// // currentDeviceAlreadyProvisioned: boolean,
// // currentDeviceType: DeviceType,
// // otherDeviceType: DeviceType,
// defaultTab: Tab,
// // validTabs: Array<Tab>,
// tabDetails: {[tab: Tab]: TabDetails},
// // enterQrCodeInstructions: string,
// // enterTextCodeInputHint: string,
// // enterTextCodeInstructions: React.Node,
// // isValidLookingCode: string => boolean,
// onSubmitTextCode: (textCode: string) => void,
// // viewQrCode: string,
// // viewQrCodeInstructions: string,
// // viewTextCode: string,
// // viewTextCodeInstructions: string,
// }

type State = {
  tab: Tab,
}

// const PanelContainer = ({instructions, children, }) => (
// <Box2 direction="vertical" style={styles.panelContainer} gap="medium" gapStart={true}>
// {instructions}
// {children}
// </Box2>
// )

const _tabsMap = {
  QR: 'Scan QR Code',
  enterText: 'Enter a text code',
  viewText: 'See a text code',
}

const Tabs = (props: {tabs: Array<Tab>, selected: Tab, onSelect: Tab => void}) =>
  props.tabs.map(tab => (
    <Text
      key={tab}
      type={tab === props.selected ? 'BodySecondaryLink' : 'BodyPrimaryLink'}
      style={styles.tab}
      onClick={() => props.onSelect(tab)}
    >
      {_tabsMap[tab]}
    </Text>
  ))

class CodePage2 extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {tab: this._defaultTab(this.props)}
  }

  componentDidUpdate(prevProps: Props) {
    const curDefault = this._defaultTab(this.props)
    const prevDefault = this._defaultTab(prevProps)
    if (curDefault !== prevDefault) {
      this.setState({tab: curDefault})
    }
  }

  // _getContent = () => {
  // switch (this.state.tab) {
  // case 'scanQR':
  // return (
  // <ScanQR onScan={this.props.onSubmitTextCode} instructions={this.props.viewQrCodeInstructions} />
  // )
  // case 'viewQR':
  // return <ViewQR url={this.props.viewQrCode} instructions={this.props.viewQrCodeInstructions} />
  // case 'enterText':
  // return (
  // <EnterText
  // isValidLookingCode={this.props.isValidLookingCode}
  // instructions={this.props.enterTextCodeInstructions}
  // inputHint={this.props.enterTextCodeInputHint}
  // onSubmit={this.props.onSubmitTextCode}
  // />
  // )
  // case 'viewText':
  // return <ViewText code={this.props.viewTextCode} instructions={this.props.viewTextCodeInstructions} />
  // default:
  // return null
  // }
  // }

  _validTabs = () => {
    if (this.props.currentDeviceType === 'desktop' && this.props.otherDeviceType === 'desktop') {
      return ['viewText', 'enterText']
    } else {
      return ['QR', 'viewText', 'enterText']
    }
  }

  _defaultTab = (props: Props) => {
    const oppositeTabMap = {
      QR: 'QR',
      enterText: 'viewText',
      viewText: 'enterText',
    }
    const getTabOrOpposite = tabToShowToNew =>
      props.currentDeviceAlreadyProvisioned ? oppositeTabMap[tabToShowToNew] : tabToShowToNew

    if (props.currentDeviceType === 'phone') {
      return getTabOrOpposite('QR')
    } else if (props.currentDeviceType === 'desktop') {
      return props.otherDeviceType === 'desktop' ? getTabOrOpposite('viewText') : getTabOrOpposite('QR')
    }

    throw new Error('Impossible defaultTab')
  }

  render() {
    return (
      <Box2 direction="vertical">
        <Qr {...this.props} />
        <Box2 direction="horizontal" gap="small">
          <Tabs tabs={this._validTabs()} selected={this.state.tab} onSelect={tab => this.setState({tab})} />
        </Box2>
      </Box2>
    )
  }
}

const Qr = (p: Props) => {
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
    <Box2
      direction="vertical"
      style={styles.qrContainer}
      gap="medium"
      gapStart={true}
      fullWidth={true}
      fullHeight={true}
    >
      {instructions}
      <Box2
        style={collapseStyles([styles.qrHolder, p.currentDeviceAlreadyProvisioned && styles.qrHolderFlip])}
        direction="vertical"
      >
        <QRImage url={p.QRUrl} />
        <QRScan onScan={p.onSubmitTextCode} />
      </Box2>
    </Box2>
  )
}

// const tabDetails = (p: CommonParam): {[tab: Tab]: TabDetails} => {
// if (p.currentDeviceAlreadyProvisioned) {
// if (p.otherDeviceType === 'phone') {
// return {
// QR: (
// <Box2 direction="vertical">
// <Text type="Body">
// In <Text type="BodySemiboldItalic">{p.otherDeviceName}</Text>, go to Devices > Add new > New
// phone.
// </Text>
// </Box2>
// ),
// }
// if (p.currentDeviceType === 'phone') {
// } else {
// }
// } else {
// if (p.otherDeviceType === 'phone') {
// return {QR: <QR {...p} />}
// }
// }
// }
// }

// export const getOptions = (p: CommonParam): Options => {
// return {
// defaultTab: defaultTab(p),
// // enterQrCodeInstructions: p.currentDeviceAlreadyProvisioned
// // ? howToViewQRCodeOnNewDevice(p)
// // : howToViewQRCodeOnExistingDevice(p),
// // enterTextCodeInputHint: p.currentDeviceAlreadyProvisioned
// // ? enterTextCodeInputHintForNewDevice(p)
// // : enterTextCodeInputHintForExistingDevice(p),
// // enterTextCodeInstructions: p.currentDeviceAlreadyProvisioned
// // ? howToGetTextCodeOnNewDevice(p)
// // : howToGetTextCodeOnExistingDevice(p),
// validTabs: validTabs(p),
// tabDetails: tabDetails(p),
// // viewTextCodeInstructions: p.currentDeviceAlreadyProvisioned
// // ? howToEnterTextCodeOnNewDevice(p)
// // : howToEnterTextCodeOnExistingDevice(p),
// // viewQrCodeInstructions: p.currentDeviceAlreadyProvisioned
// // ? howToScanQRCodeOnNewDevice(p)
// // : howToScanQRCodeOnExistingDevice(p),
// }
// }

const styles = styleSheetCreate({
  qrContainer: {
    backgroundColor: globalColors.blue2,
  },
  qrHolder: {
    width: 220,
    backgroundColor: globalColors.white,
    borderRadius: 8,
    padding: 4,
  },
  qrHolderFlip: {
    flexDirection: 'column-flip',
  },
  // panelContainer: {
  // alignItems: 'center',
  // },
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
export default CodePage2
