import * as React from 'react'
import * as Constants from '../../constants/provision'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Flow from '../../util/flow'
import QRImage from './qr-image'
import QRScan from './qr-scan/container'
import {isAndroid} from '../../constants/platform'

const blueBackground = require('../../images/illustrations/bg-provisioning-blue.png')
const greenBackground = require('../../images/illustrations/bg-provisioning-green.png')

export type DeviceType = 'mobile' | 'desktop'
export type Tab = 'QR' | 'enterText' | 'viewText'

type Props = {
  error: string
  currentDeviceAlreadyProvisioned: boolean
  currentDeviceType: DeviceType
  currentDeviceName: string
  otherDeviceName: string
  otherDeviceType: DeviceType
  tabOverride?: Tab | null
  textCode: string
  onBack: () => void
  onSubmitTextCode: (code: string) => void
}

type State = {
  tab: Tab
}

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

  _tabBackground = () => (this.state.tab === 'QR' ? Styles.globalColors.blueLight : Styles.globalColors.green)

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
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(this.state.tab)
        content = null
    }

    return (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        style={Styles.collapseStyles([
          styles.codePageContainer,
          styles.safeArea,
          Styles.globalStyles.flexBoxColumn,
          {backgroundColor: this._tabBackground()},
        ])}
      >
        <Kb.SafeAreaView style={Styles.collapseStyles([styles.safeArea, Styles.globalStyles.flexBoxColumn])}>
          <Kb.Box2
            direction="vertical"
            fullHeight={true}
            style={
              this.props.currentDeviceAlreadyProvisioned
                ? styles.imageContainerOnLeft
                : styles.imageContainerOnRight
            }
          >
            <Kb.RequireImage
              src={this.state.tab === 'QR' ? blueBackground : greenBackground}
              style={
                this.props.currentDeviceAlreadyProvisioned
                  ? styles.backgroundOnLeft
                  : styles.backgroundOnRight
              }
            />
          </Kb.Box2>
          {this.props.currentDeviceAlreadyProvisioned && (
            <Kb.BackButton
              onClick={this.props.onBack}
              iconColor={Styles.globalColors.white}
              style={styles.backButton}
              textStyle={styles.backButtonText}
            />
          )}
          {!!this.props.error && <ErrorBanner error={this.props.error} />}
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.scrollContainer}>
            <Kb.ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} gap="tiny">
                <Instructions {...this.props} />
                {content}
                <SwitchTab {...this.props} selected={this.state.tab} onSelect={tab => this.setState({tab})} />
              </Kb.Box2>
            </Kb.ScrollView>
          </Kb.Box2>
        </Kb.SafeAreaView>
      </Kb.Box2>
    )
  }
}

const ErrorBanner = (props: {error: string}) => (
  <Kb.Box2 direction="vertical" style={styles.errorContainer}>
    <Kb.Text center={true} type="Body" style={styles.errorText}>
      {props.error}
    </Kb.Text>
  </Kb.Box2>
)

const textType = Styles.isMobile ? 'BodyBig' : 'Header'

const SwitchTab = (
  props: {
    selected: Tab
    onSelect: (tab: Tab) => void
  } & Props
) => {
  if (props.currentDeviceType === 'desktop' && props.otherDeviceType === 'desktop') {
    return <Kb.Box2 direction="horizontal" />
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
    <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.switchTabContainer}>
      <Kb.Icon type={icon} color={Styles.globalColors.white} />
      <Kb.Text type={textType} onClick={() => props.onSelect(tab)} style={styles.switchTab}>
        {label}
      </Kb.Text>
    </Kb.Box2>
  )
}

const Qr = (props: Props) =>
  props.currentDeviceType === 'desktop' ? (
    <Kb.Box2 direction="vertical" style={styles.qrOnlyContainer}>
      <QRImage code={props.textCode} cellSize={10} />
    </Kb.Box2>
  ) : (
    <Kb.Box2
      style={Styles.collapseStyles([
        styles.qrContainer,
        props.currentDeviceAlreadyProvisioned && styles.qrContainerFlip,
      ])}
      direction="vertical"
    >
      <Kb.Box2 direction="vertical" style={styles.qrImageContainer}>
        <QRImage code={props.textCode} />
      </Kb.Box2>
      <QRScan />
    </Kb.Box2>
  )

class EnterText extends React.Component<
  Props,
  {
    code: string
  }
> {
  state = {code: ''}

  _submit = () => {
    this.props.onSubmitTextCode(this.state.code)
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" style={styles.enterTextContainer} gap="small">
        <Kb.PlainInput
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
        <Kb.WaitingButton
          fullWidth={true}
          backgroundColor="green"
          label="Submit"
          onClick={this._submit}
          disabled={!this.state.code}
          style={styles.enterTextButton}
          waitingKey={Constants.waitingKey}
        />
      </Kb.Box2>
    )
  }
}

const ViewText = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.viewTextContainer}>
    <Kb.Text center={true} type="Terminal" style={styles.viewTextCode}>
      {props.textCode}
    </Kb.Text>
  </Kb.Box2>
)

const Instructions = (p: Props) => (
  <Kb.Box2 direction="vertical">
    {p.currentDeviceAlreadyProvisioned ? (
      <React.Fragment>
        <Kb.Text center={true} type={textType} style={styles.instructions}>
          Ready to provision using
        </Kb.Text>
        <Kb.Text center={true} type={textType} style={styles.instructionsItalic}>
          {p.currentDeviceName}.
        </Kb.Text>
      </React.Fragment>
    ) : (
      <React.Fragment>
        <Kb.Text center={true} type={textType} style={styles.instructions}>
          On{' '}
          <Kb.Text center={true} type={textType} style={styles.instructionsItalic}>
            {p.otherDeviceName}
          </Kb.Text>
          , go to
        </Kb.Text>
        <Kb.Box2 direction="horizontal" alignItems="center" gap="xtiny">
          <Kb.Text center={true} type={textType} style={styles.instructions}>
            Devices
          </Kb.Text>
          <Kb.Icon type="iconfont-arrow-right" color={Styles.globalColors.white} sizeType="Small" />
          <Kb.Text center={true} type={textType} style={styles.instructions}>
            Add device
          </Kb.Text>
          <Kb.Icon type="iconfont-arrow-right" color={Styles.globalColors.white} sizeType="Small" />
          <Kb.Text center={true} type={textType} style={styles.instructions}>
            New {p.currentDeviceType === 'desktop' ? 'computer' : 'phone'}.
          </Kb.Text>
        </Kb.Box2>
      </React.Fragment>
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  backButton: Styles.platformStyles({
    isElectron: {
      marginLeft: Styles.globalMargins.medium,
      marginTop: Styles.globalMargins.medium,
      // else the background can go above things, annoyingly
      zIndex: 1,
    },
    isMobile: {
      marginBottom: 0,
      marginLeft: 0,
      marginTop: 0,
    },
  }),
  backButtonText: {
    color: Styles.globalColors.white,
  },
  backgroundOnLeft: {
    marginLeft: -230,
  },
  backgroundOnRight: {
    marginRight: -230,
  },
  codePageContainer: Styles.platformStyles({
    common: {
      overflow: 'hidden',
      position: 'relative',
    },
    isElectron: {
      minHeight: 400,
      minWidth: 400,
    },
  }),
  container: Styles.platformStyles({
    common: {
      justifyContent: 'space-between',
    },
    isElectron: {
      height: '100%',
      padding: Styles.globalMargins.large,
      // else the background can go above things, annoyingly
      zIndex: 1,
    },
    isMobile: {
      flexGrow: 1,
      paddingBottom: Styles.globalMargins.small,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: 0, // increasing this makes it not visible all on one page in small iPhones, so let's leave it
    },
  }),
  enterTextButton: {
    maxWidth: Styles.isMobile ? undefined : 460,
    width: '100%',
  },
  enterTextContainer: {
    alignItems: Styles.isMobile ? 'stretch' : 'center',
    alignSelf: 'stretch',
  },
  enterTextInput: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.fontTerminalSemibold,
      backgroundColor: Styles.globalColors.white,
      borderRadius: 4,
      color: Styles.globalColors.greenDark,
      paddingBottom: 15,
      paddingLeft: 20,
      paddingRight: 20,
      paddingTop: 15,
    },
    isElectron: {
      fontSize: 16,
      maxWidth: 460,
    },
    isMobile: {
      width: '100%',
    },
  }),
  errorContainer: {
    alignItems: 'center',
    backgroundColor: Styles.globalColors.red,
    marginTop: Styles.globalMargins.small,
    padding: Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.medium,
    width: '100%',
  },
  errorText: {color: Styles.globalColors.white},
  imageContainerOnLeft: {
    ...Styles.globalStyles.fillAbsolute,
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  imageContainerOnRight: {
    ...Styles.globalStyles.fillAbsolute,
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  instructions: {color: Styles.globalColors.white},
  instructionsContainer: {
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  instructionsItalic: {
    ...Styles.globalStyles.italic,
    color: Styles.globalColors.white,
  },
  qrContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      borderRadius: isAndroid ? 0 : 8, // If this is set to ANYTHING other than 0 android DOESN"T WORK!!!!!! The qr scanner totally breaks
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
    backgroundColor: Styles.globalColors.white,
    borderRadius: 8,
    padding: 20,
  },
  safeArea: {
    height: '100%',
    width: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    position: 'relative',
  },
  scrollContent: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      flexGrow: 1,
      height: '100%',
    },
  }),
  scrollView: {
    // want the scroll contents to be the full height
    ...Styles.globalStyles.fillAbsolute,
    ...Styles.globalStyles.flexBoxColumn,
  },
  switchTab: {
    color: Styles.globalColors.white,
    marginBottom: 4,
  },
  switchTabContainer: {
    alignItems: 'center',
  },
  viewTextCode: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.fontTerminalSemibold,
      color: Styles.globalColors.white,
      fontSize: 16,
    },
    isElectron: {
      maxWidth: 330,
    },
    isMobile: {},
  }),
  viewTextContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.green,
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
