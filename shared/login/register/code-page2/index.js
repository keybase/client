// @flow
import * as React from 'react'
import * as Constants from '../../../constants/login'
import {Button, Box2, Text, PlainInput, WaitingButton} from '../../../common-adapters'
import {
  collapseStyles,
  globalColors,
  globalMargins,
  globalStyles,
  isMobile,
  styleSheetCreate,
} from '../../../styles'
import QRImage from './qr-image'
import QRScan from './qr-scan'

export type DeviceType = 'phone' | 'desktop'
export type Tab = 'QR' | 'enterText' | 'viewText'

type Props = {
  username: string,
  currentDeviceAlreadyProvisioned: boolean,
  currentDeviceType: DeviceType,
  currentDeviceName: string,
  otherDeviceName: string,
  otherDeviceType: DeviceType,
  // only in storybook
  tabOverride?: ?Tab,
  textCode: string,
  onSubmitTextCode: string => void,
}

type State = {
  tab: Tab,
}

const Tabs = (props: {tabs: Array<Tab>, selected: Tab, onSelect: Tab => void}) => (
  <Box2 direction="horizontal" gap="small">
    {props.tabs.map(tab => (
      <Button
        type={tab === props.selected ? 'Primary' : 'Secondary'}
        key={tab}
        label={tab}
        onClick={() => props.onSelect(tab)}
      />
    ))}
  </Box2>
)

class CodePage2 extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      tab: (__STORYBOOK__ && this.props.tabOverride) || this._defaultTab(this.props),
    }
  }

  componentDidUpdate(prevProps: Props) {
    const curDefault = this._defaultTab(this.props)
    const prevDefault = this._defaultTab(prevProps)
    if (curDefault !== prevDefault) {
      this.setState({tab: curDefault})
    }
  }

  static _validTabs = (currentDeviceType, otherDeviceType) => {
    if (currentDeviceType === 'desktop' && otherDeviceType === 'desktop') {
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

  _tabBackground = () => (this.state.tab === 'QR' ? globalColors.blue2 : globalColors.green)

  render() {
    let content
    switch (this.state.tab) {
      case 'QR':
        content = <Qr {...this.props} />
        break
      case 'viewText':
        content = <ViewText {...this.props} />
        break
      case 'enterText':
        content = <EnterText {...this.props} />
        break
      default:
        /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(this.state.tab);
      */
        content = null
    }
    return (
      <Box2
        direction="vertical"
        style={collapseStyles([styles.container, {backgroundColor: this._tabBackground()}])}
        fullWidth={true}
        fullHeight={true}
      >
        <Instructions {...this.props} />
        {content}

        <Tabs
          tabs={CodePage2._validTabs(this.props.currentDeviceType, this.props.otherDeviceType)}
          selected={this.state.tab}
          onSelect={tab => this.setState({tab})}
        />
      </Box2>
    )
  }
}

const Qr = (props: Props) => (
  <Box2
    style={collapseStyles([
      styles.qrContainer,
      props.currentDeviceAlreadyProvisioned && styles.qrContainerFlip,
    ])}
    direction="vertical"
  >
    <Box2 direction="vertical" style={styles.qrImageContainer}>
      <QRImage code={props.textCode} />
    </Box2>
    <QRScan onScan={props.onSubmitTextCode} />
  </Box2>
)

class EnterText extends React.Component<Props, {code: string}> {
  state = {code: ''}

  _submit = () => {
    this.props.onSubmitTextCode(this.state.code)
  }

  render() {
    return (
      <Box2 direction="vertical" style={styles.enterTextContainer} gap="small">
        <PlainInput
          placeholderColor={globalColors.green}
          multiline={true}
          onChangeText={code => this.setState({code})}
          onEnterKeyDown={this._submit}
          rowsMin={3}
          placeholder="Type the 10-word secret code"
          textType="Terminal"
          style={styles.enterTextInput}
          value={this.state.code}
        />
        <WaitingButton
          type="Primary"
          label="Submit"
          onClick={this._submit}
          waitingKey={Constants.keyWaitingKey}
        />
      </Box2>
    )
  }
}

const ViewText = (props: Props) => (
  <Box2 direction="vertical" style={styles.viewTextContainer}>
    <Text type="Terminal" style={styles.viewTextCode}>
      {props.textCode}
    </Text>
  </Box2>
)

const Instructions = (p: Props) => (
  <Box2 direction="vertical">
    {p.currentDeviceAlreadyProvisioned ? (
      <Text type="Header" style={styles.instructions}>
        Ready to provision using{' '}
        <Text type="HeaderExtrabold" style={styles.instructions}>
          {p.otherDeviceName}
        </Text>
      </Text>
    ) : (
      <Text type="Header" style={styles.instructions}>
        In{' '}
        <Text type="HeaderExtrabold" style={styles.instructions}>
          {p.otherDeviceName}
        </Text>, go to {p.otherDeviceType === 'phone' ? 'Settings > ' : ''}Devices > Add new > New{' '}
        {p.otherDeviceType}.
      </Text>
    )}
  </Box2>
)

const styles = styleSheetCreate({
  container: {
    justifyContent: 'space-between',
    padding: globalMargins.large,
  },
  enterTextContainer: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  enterTextInput: {
    ...globalStyles.fontTerminalSemibold,
    backgroundColor: globalColors.white,
    borderRadius: 4,
    color: globalColors.green,
    fontSize: 16,
    maxWidth: isMobile ? 300 : 460,
    paddingBottom: 15,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 15,
  },
  instructions: {
    color: globalColors.white,
    textAlign: 'center',
  },
  qrContainer: {
    backgroundColor: globalColors.white,
    borderRadius: 8,
    flexDirection: 'column',
    padding: 4,
    width: 220,
  },
  qrContainerFlip: {
    flexDirection: 'column-reverse',
  },
  qrImageContainer: {
    paddingBottom: 30,
    paddingTop: 30,
  },
  viewTextCode: {
    ...globalStyles.fontTerminalSemibold,
    color: globalColors.white,
    fontSize: 16,
    maxWidth: isMobile ? 200 : 330,
    textAlign: 'center',
  },
  viewTextContainer: {
    backgroundColor: globalColors.green2,
    borderRadius: 4,
    maxWidth: isMobile ? 300 : 460,
    paddingBottom: 20,
    paddingLeft: 64,
    paddingRight: 64,
    paddingTop: 20,
  },
})
export default CodePage2
