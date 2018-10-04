// @flow
import * as React from 'react'
import * as Constants from '../../constants/provision'
import {RequireImage, Icon, Box2, Text, PlainInput, WaitingButton, BackButton} from '../../common-adapters'
import {
  platformStyles,
  collapseStyles,
  globalColors,
  globalMargins,
  globalStyles,
  isMobile,
  styleSheetCreate,
} from '../../styles'
import QRImage from './qr-image'
import QRScan from './qr-scan/container'
import {iconMeta} from '../../common-adapters/icon.constants'

const blueBackground = require('../../images/illustrations/bg-provisioning-blue.png')
const greenBackground = require('../../images/illustrations/bg-provisioning-green.png')

export type DeviceType = 'mobile' | 'desktop'
export type Tab = 'QR' | 'enterText' | 'viewText'

type Props = {|
  error: string,
  currentDeviceAlreadyProvisioned: boolean,
  currentDeviceType: DeviceType,
  currentDeviceName: string,
  otherDeviceName: string,
  otherDeviceType: DeviceType,
  // only in storybook
  tabOverride?: ?Tab,
  textCode: string,
  onBack: () => void,
  onSubmitTextCode: string => void,
|}

type State = {|
  tab: Tab,
|}

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

    if (props.currentDeviceType === 'mobile') {
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
        fullWidth={true}
        fullHeight={true}
        style={collapseStyles([styles.codePageContainer, {backgroundColor: this._tabBackground()}])}
      >
        <Box2
          direction="vertical"
          fullHeight={true}
          style={
            this.props.currentDeviceAlreadyProvisioned
              ? styles.imageContainerOnLeft
              : styles.imageContainerOnRight
          }
        >
          <RequireImage
            src={this.state.tab === 'QR' ? blueBackground : greenBackground}
            style={
              this.props.currentDeviceAlreadyProvisioned ? styles.backgroundOnLeft : styles.backgroundOnRight
            }
          />
        </Box2>
        <BackButton
          onClick={this.props.onBack}
          iconColor={globalColors.white}
          style={styles.backButton}
          textStyle={styles.backButtonText}
        />
        {!!this.props.error && <ErrorBanner error={this.props.error} />}
        <Box2 direction="vertical" style={styles.container} fullWidth={true}>
          <Instructions {...this.props} />
          {content}
          <SwitchTab {...this.props} selected={this.state.tab} onSelect={tab => this.setState({tab})} />
        </Box2>
      </Box2>
    )
  }
}

const ErrorBanner = (props: {error: string}) => (
  <Box2 direction="vertical" style={styles.errorContainer}>
    <Text type="Body" style={styles.errorText}>
      {props.error}
    </Text>
  </Box2>
)

const SwitchTab = (props: {|...Props, selected: Tab, onSelect: Tab => void|}) => {
  if (props.currentDeviceType === 'desktop' && props.otherDeviceType === 'desktop') {
    return <Box2 direction="horizontal" />
  }

  let label
  let icon
  let tab

  if (props.selected === 'QR') {
    label = 'Type secret instead'
    icon = 'iconfont-text-code'
    if (props.currentDeviceType === 'mobile' && props.otherDeviceType === 'mobile') {
      tab = props.currentDeviceAlreadyProvisioned ? 'enterText' : 'viewText'
    } else if (props.currentDeviceType === 'mobile') {
      tab = 'viewText'
    } else {
      tab = 'enterText'
    }
  } else {
    label = 'Scan QR instead'
    icon = 'iconfont-qr-code'
    tab = 'QR'
  }

  return (
    <Box2 direction="horizontal" gap="xtiny" style={styles.switchTabContainer}>
      <Icon type={icon} color={globalColors.white} />
      <Text type="Header" onClick={() => props.onSelect(tab)} style={styles.switchTab}>
        {label}
      </Text>
    </Box2>
  )
}

const Qr = (props: Props) =>
  props.currentDeviceType === 'desktop' ? (
    <Box2 direction="vertical" style={styles.qrOnlyContainer}>
      <QRImage code={props.textCode} cellSize={10} />
    </Box2>
  ) : (
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
      <QRScan />
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
          autoFocus={true}
          multiline={true}
          onChangeText={code => this.setState({code})}
          onEnterKeyDown={this._submit}
          rowsMin={3}
          placeholder={`Type the ${this.props.otherDeviceType === 'mobile' ? '9' : '8'}-word secret code`}
          textType="Terminal"
          style={styles.enterTextInput}
          value={this.state.code}
        />
        <WaitingButton
          fullWidth={true}
          type="PrimaryColoredBackground"
          backgroundMode="Green"
          label="Submit"
          onClick={this._submit}
          disabled={!this.state.code}
          style={styles.enterTextButton}
          waitingKey={Constants.waitingKey}
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
      <React.Fragment>
        <Text type="Header" style={styles.instructions}>
          Ready to provision using
        </Text>
        <Text type="Header" style={styles.instructionsItalic}>
          {p.currentDeviceName}.
        </Text>
      </React.Fragment>
    ) : (
      <React.Fragment>
        <Text type="Header" style={styles.instructions}>
          On
          <Text type="Header" style={styles.instructionsItalic}>
            {' '}
            {p.otherDeviceName}
          </Text>
          , go to
        </Text>
        <Text type="Header" style={styles.instructions}>
          Devices
          <Text type="Header" style={styles.instructionsCarets}>
            {` ${String.fromCharCode(iconMeta['iconfont-arrow-right'].charCode || 0)} `}
          </Text>
          <Text type="Header" style={styles.instructions}>
            Add new
          </Text>
          <Text type="Header" style={styles.instructionsCarets}>
            {` ${String.fromCharCode(iconMeta['iconfont-arrow-right'].charCode || 0)} `}
          </Text>
          <Text type="Header" style={styles.instructions}>
            New {p.currentDeviceType === 'desktop' ? 'computer' : 'phone'}.
          </Text>
        </Text>
      </React.Fragment>
    )}
  </Box2>
)

const styles = styleSheetCreate({
  backButton: platformStyles({
    isElectron: {
      marginLeft: globalMargins.medium,
      marginTop: globalMargins.medium,
      // else the background can go above things, annoyingly
      zIndex: 1,
    },
    isMobile: {
      marginLeft: 0,
      marginTop: 0,
    },
  }),
  backButtonText: {
    color: globalColors.white,
  },
  backgroundOnLeft: {
    marginLeft: -230,
  },
  backgroundOnRight: {
    marginRight: -230,
  },
  codePageContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  container: platformStyles({
    common: {
      justifyContent: 'space-between',
    },
    isElectron: {
      height: '100%',
      padding: globalMargins.large,
      // else the background can go above things, annoyingly
      zIndex: 1,
    },
    isMobile: {
      flexGrow: 1,
      padding: globalMargins.small,
    },
  }),
  enterTextButton: {
    maxWidth: isMobile ? undefined : 460,
    width: '100%',
  },
  enterTextContainer: {
    alignItems: isMobile ? 'stretch' : 'center',
    alignSelf: 'stretch',
  },
  enterTextInput: platformStyles({
    common: {
      ...globalStyles.fontTerminalSemibold,
      backgroundColor: globalColors.white,
      borderRadius: 4,
      color: globalColors.green,
      fontSize: 16,
      paddingBottom: 15,
      paddingLeft: 20,
      paddingRight: 20,
      paddingTop: 15,
    },
    isElectron: {
      maxWidth: 460,
    },
    isMobile: {
      maxWidth: 360,
    },
  }),
  errorContainer: {
    alignItems: 'center',
    backgroundColor: globalColors.red,
    marginTop: globalMargins.small,
    padding: isMobile ? globalMargins.tiny : globalMargins.medium,
    width: '100%',
  },
  errorText: {
    color: globalColors.white,
    textAlign: 'center',
  },
  imageContainerOnLeft: {
    ...globalStyles.fillAbsolute,
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  imageContainerOnRight: {
    ...globalStyles.fillAbsolute,
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  instructions: {
    color: globalColors.white,
    textAlign: 'center',
  },
  instructionsCarets: platformStyles({
    common: {
      color: globalColors.white,
      fontFamily: 'kb',
      fontStyle: 'normal',
      fontWeight: 'normal',
      textAlign: 'center',
    },
    isElectron: {
      WebkitFontSmoothing: 'antialiased',
      fontVariant: 'normal',
      speak: 'none',
      textTransform: 'none',
    },
  }),
  instructionsContainer: {
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  instructionsItalic: {
    ...globalStyles.italic,
    color: globalColors.white,
    textAlign: 'center',
  },
  qrContainer: platformStyles({
    common: {
      backgroundColor: globalColors.white,
      borderRadius: 8,
      flexDirection: 'column',
      padding: 4,
    },
    isElectron: {
      width: 220,
    },
    isMobile: {
      width: 200,
    },
  }),
  qrContainerFlip: {
    flexDirection: 'column-reverse',
  },
  qrImageContainer: {
    paddingBottom: 30,
    paddingTop: 30,
  },
  qrOnlyContainer: {
    backgroundColor: globalColors.white,
    borderRadius: 8,
    padding: 20,
  },
  switchTab: {
    color: globalColors.white,
    marginBottom: 4,
  },
  switchTabContainer: {
    alignItems: 'center',
  },
  viewTextCode: platformStyles({
    common: {
      ...globalStyles.fontTerminalSemibold,
      color: globalColors.white,
      fontSize: 16,
      textAlign: 'center',
    },
    isElectron: {
      maxWidth: 330,
    },
    isMobile: {},
  }),
  viewTextContainer: platformStyles({
    common: {
      backgroundColor: globalColors.green,
      borderRadius: 4,
    },
    isElectron: {
      alignItems: 'center',
      maxWidth: 460,
      paddingBottom: 20,
      paddingLeft: 64,
      paddingRight: 64,
      paddingTop: 20,
    },
    isMobile: {
      alignItems: 'center',
      alignSelf: 'stretch',
      paddingBottom: 20,
      paddingLeft: 20,
      paddingRight: 20,
      paddingTop: 20,
    },
  }),
})
export default CodePage2
