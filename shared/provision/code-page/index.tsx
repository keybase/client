import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import QRImage from './qr-image'
import QRScan from './qr-scan/container'
import Troubleshooting from '../troubleshooting'
import type * as T from '@/constants/types'

export type DeviceType = 'mobile' | 'desktop'
export type Tab = 'QR' | 'enterText' | 'viewText'

const currentDeviceType: DeviceType = Kb.Styles.isMobile ? 'mobile' : 'desktop'

type Props = {
  error: string
  currentDevice: T.Devices.Device
  currentDeviceAlreadyProvisioned: boolean
  currentDeviceName: string
  iconNumber: T.Devices.IconNumber
  otherDevice: C.Provision.Device
  tabOverride?: Tab
  textCode: string
  onBack: () => void
  onClose: () => void
  onSubmitTextCode: (code: string) => void
  waiting: boolean
}

type State = {
  code: string
  tab: Tab
  troubleshooting: boolean
}

class CodePage2 extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      code: '',
      tab: this._defaultTab(this.props),
      troubleshooting: false,
    }
  }

  componentDidUpdate(prevProps: Props) {
    const curDefault = this._defaultTab(this.props)
    const prevDefault = this._defaultTab(prevProps)
    if (curDefault !== prevDefault) {
      this.setState({tab: curDefault})
    }
  }

  componentWillUnmount() {
    // Troubleshooting modal may send us back to the devices page; it already cancels in that case
    !this.state.troubleshooting && this.props.onClose()
  }

  _defaultTab = (props: Props): Tab => {
    const getTabOrOpposite = (tabToShowToNew: Tab) => {
      if (!props.currentDeviceAlreadyProvisioned) return tabToShowToNew
      switch (tabToShowToNew) {
        case 'QR':
          return 'QR'
        case 'enterText':
          return 'viewText'
        case 'viewText':
          return 'enterText'
      }
    }

    switch (currentDeviceType) {
      case 'mobile':
        return getTabOrOpposite('QR')
      case 'desktop':
        return props.otherDevice.type === 'desktop' ? getTabOrOpposite('viewText') : getTabOrOpposite('QR')
    }
  }

  _tabBackground = () =>
    this.state.tab === 'QR' ? Kb.Styles.globalColors.blueLight : Kb.Styles.globalColors.green
  _buttonBackground = () => (this.state.tab === 'QR' ? 'blue' : 'green')

  _setCode = (code: string) => this.setState(s => (s.code === code ? null : {code}))
  _onSubmitTextCode = () => this.props.onSubmitTextCode(this.state.code)

  _header = () => {
    return Kb.Styles.isMobile
      ? {
          leftButton: (
            <Kb.Text type="BodyBig" onClick={this.props.onBack} negative={true}>
              {this.props.currentDeviceAlreadyProvisioned ? 'Back' : 'Cancel'}
            </Kb.Text>
          ),
          style: {backgroundColor: this._tabBackground()},
        }
      : undefined
  }
  _body = () => {
    let content: React.ReactNode = null
    switch (this.state.tab) {
      case 'QR':
        content = <Qr {...this.props} />
        break
      case 'viewText':
        content = <ViewText {...this.props} />
        break
      case 'enterText':
        content = <EnterText {...this.props} code={this.state.code} setCode={this._setCode} />
        break
      default:
    }
    return (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([styles.codePageContainer, {backgroundColor: this._tabBackground()}])}
      >
        <Kb.Box2
          direction="vertical"
          fullHeight={true}
          style={
            this.props.currentDeviceAlreadyProvisioned
              ? styles.imageContainerOnLeft
              : styles.imageContainerOnRight
          }
        >
          <Kb.Icon
            type={
              this.state.tab === 'QR'
                ? 'illustration-bg-provisioning-blue'
                : 'illustration-bg-provisioning-green'
            }
            style={
              this.props.currentDeviceAlreadyProvisioned ? styles.backgroundOnLeft : styles.backgroundOnRight
            }
          />
        </Kb.Box2>
        {!this.props.currentDeviceAlreadyProvisioned && !Kb.Styles.isMobile && (
          <>
            <Kb.BackButton
              onClick={this.props.onBack}
              iconColor={Kb.Styles.globalColors.white}
              style={styles.backButton}
              textStyle={styles.backButtonText}
            />
            <Kb.Divider />
          </>
        )}
        {!!this.props.error && <Kb.Banner color="red">{this.props.error}</Kb.Banner>}
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.scrollContainer}>
          <Kb.Box2 direction="vertical" fullHeight={true} style={Kb.Styles.globalStyles.flexGrow}>
            <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} gap="tiny">
              <Instructions {...this.props} />
              {content}
              <SwitchTab {...this.props} selected={this.state.tab} onSelect={tab => this.setState({tab})} />
              {!this._inModal() && this._footer().content}
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
        {!this._inModal() &&
          currentDeviceType === 'desktop' &&
          currentDeviceType === this.props.otherDevice.type &&
          !this.props.currentDeviceAlreadyProvisioned &&
          this._heyWaitBanner()}
        {!this._inModal() && this.state.troubleshooting && (
          <Kb.Overlay onHidden={() => this.setState({troubleshooting: false})} propagateOutsideClicks={true}>
            {this._troubleshooting()}
          </Kb.Overlay>
        )}
      </Kb.Box2>
    )
  }
  _footer = () => {
    const showHeyWaitInFooter =
      currentDeviceType === 'mobile' &&
      currentDeviceType === this.props.otherDevice.type &&
      !this.props.currentDeviceAlreadyProvisioned
    return {
      content: (
        <Kb.Box2
          alignItems="center"
          direction="vertical"
          gap={Kb.Styles.isMobile ? 'medium' : 'small'}
          gapEnd={!showHeyWaitInFooter}
          fullWidth={true}
        >
          {this.state.tab === 'enterText' && (
            <Kb.WaitingButton
              fullWidth={true}
              backgroundColor={this._buttonBackground()}
              label="Continue"
              onClick={this._onSubmitTextCode}
              disabled={!this.state.code || this.props.waiting}
              style={styles.enterTextButton}
              waitingKey={C.Provision.waitingKey}
            />
          )}
          {this.state.tab !== 'enterText' && this._inModal() && !Kb.Styles.isMobile && (
            <Kb.WaitingButton
              fullWidth={true}
              backgroundColor={this._buttonBackground()}
              label="Close"
              onClick={this.props.onBack}
              onlyDisable={true}
              style={styles.closeButton}
              waitingKey={C.Provision.waitingKey}
            />
          )}
          {showHeyWaitInFooter && this._heyWaitBanner()}
        </Kb.Box2>
      ),
      hideBorder: !this._inModal() || currentDeviceType !== 'desktop',
      style: {
        backgroundColor: this._tabBackground(),
        ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, 0, 0),
      },
    }
  }

  _heyWaitBanner = () => (
    <Kb.ClickableBox onClick={() => this.setState({troubleshooting: true})}>
      <Kb.Banner color="yellow">
        <Kb.BannerParagraph
          bannerColor="yellow"
          content={[
            `Are you on that ${this.props.otherDevice.type === 'mobile' ? 'phone' : 'computer'} now? `,
            {onClick: () => this.setState({troubleshooting: true}), text: 'Resolve'},
          ]}
        />
      </Kb.Banner>
    </Kb.ClickableBox>
  )

  _troubleshooting = () => (
    <Troubleshooting
      mode={this.state.tab === 'QR' ? 'QR' : 'text'}
      onCancel={() => this.setState({troubleshooting: false})}
      otherDeviceType={this.props.otherDevice.type}
    />
  )
  // We're in a modal unless this is a desktop being newly provisioned.
  _inModal = () => currentDeviceType !== 'desktop' || this.props.currentDeviceAlreadyProvisioned

  render() {
    // Workaround for no modals while logged out: display just the troubleshooting modal if we're on mobile and it's open;
    // When we're on desktop being newly provisioned, it's in this._body()
    if (Kb.Styles.isMobile && this.state.troubleshooting) {
      return this._troubleshooting()
    }
    const content = this._body()
    if (this._inModal()) {
      return (
        <Kb.Modal
          header={this._header()}
          footer={this._footer()}
          onClose={this.props.onBack}
          mode="Wide"
          mobileStyle={{backgroundColor: this._tabBackground()}}
        >
          {content}
        </Kb.Modal>
      )
    }
    return content
  }
}

const textType = 'BodySemibold'

const SwitchTab = (
  props: {
    selected: Tab
    onSelect: (tab: Tab) => void
  } & Props
) => {
  if (currentDeviceType === 'desktop' && props.otherDevice.type === 'desktop') {
    return null
  }

  let label: string
  let tab: Tab

  if (props.selected === 'QR') {
    label = 'Type secret instead'
    if (currentDeviceType === 'mobile' && props.otherDevice.type === 'mobile') {
      tab = (props.currentDeviceAlreadyProvisioned ? Kb.Styles.isMobile : !Kb.Styles.isMobile)
        ? 'viewText'
        : 'enterText'
    } else if (currentDeviceType === 'mobile') {
      tab = 'viewText'
    } else {
      tab = 'enterText'
    }
  } else {
    label = 'Scan QR instead'
    tab = 'QR'
  }

  return (
    <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.switchTabContainer}>
      <Kb.Text
        type="BodySmallPrimaryLink"
        negative={true}
        onClick={() => props.onSelect(tab)}
        style={styles.switchTab}
      >
        {label}
      </Kb.Text>
    </Kb.Box2>
  )
}

const Qr = (props: Props) =>
  currentDeviceType === 'desktop' ? (
    <Kb.Box2 direction="vertical" style={styles.qrOnlyContainer}>
      <QRImage code={props.textCode} cellSize={8} />
    </Kb.Box2>
  ) : (
    <Kb.Box2
      style={Kb.Styles.collapseStyles([
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

const EnterText = (props: Props & {code: string; setCode: (code: string) => void}) => {
  const {code, setCode} = props
  const {onSubmitTextCode} = props
  const onSubmit = React.useCallback(
    (e?: React.KeyboardEvent) => {
      e?.preventDefault()
      code && onSubmitTextCode(code)
    },
    [code, onSubmitTextCode]
  )
  return (
    <Kb.Box2 direction="vertical" style={styles.enterTextContainer} gap="small">
      <Kb.PlainInput
        autoFocus={true}
        multiline={true}
        onChangeText={setCode}
        onEnterKeyDown={onSubmit}
        rowsMin={3}
        placeholder={`Type the ${props.otherDevice.type === 'mobile' ? '9' : '8'}-word secret code`}
        textType="Terminal"
        style={styles.enterTextInput}
        value={code}
      />
    </Kb.Box2>
  )
}

const ViewText = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.viewTextContainer}>
    <Kb.Text center={true} type="Terminal" style={styles.viewTextCode}>
      {props.textCode}
    </Kb.Text>
  </Kb.Box2>
)

const getIcon = (type: T.Devices.DeviceType, iconNumber: T.Devices.IconNumber) => {
  switch (type) {
    case 'desktop':
      return `icon-computer-background-${iconNumber}-96` as const
    case 'mobile':
      return `icon-phone-background-${iconNumber}-96` as const
    default:
      return 'icon-computer-96' as const
  }
}

const Instructions = (p: Props) => {
  const icon = getIcon(
    p.currentDeviceAlreadyProvisioned ? p.currentDevice.type : p.otherDevice.type,
    p.iconNumber
  )

  return (
    <Kb.Box2 direction="vertical">
      {p.currentDeviceAlreadyProvisioned ? (
        <Kb.Box2 alignItems="center" direction="horizontal" style={styles.flexWrap}>
          <Kb.Text type={textType} style={styles.instructions}>
            Ready to authorize using
          </Kb.Text>
          <Kb.Icon
            type={icon}
            sizeType="Default"
            style={Kb.Styles.collapseStyles([
              styles.deviceIcon,
              p.currentDevice.type === 'desktop' && styles.deviceIconDesktop,
              p.currentDevice.type === 'mobile' && styles.deviceIconMobile,
            ])}
          />
          <Kb.Text type={textType} style={styles.instructions}>
            {p.currentDeviceName}.
          </Kb.Text>
        </Kb.Box2>
      ) : (
        <>
          <Kb.Box2 alignItems="flex-end" direction="horizontal" gap="xtiny">
            <Kb.Text
              type={textType}
              style={Kb.Styles.collapseStyles([styles.instructions, styles.instructionsUpper])}
            >
              On
            </Kb.Text>
            <Kb.Icon
              type={icon}
              sizeType="Default"
              style={Kb.Styles.collapseStyles([
                styles.deviceIcon,
                p.otherDevice.type === 'desktop' && styles.deviceIconDesktop,
                p.otherDevice.type === 'mobile' && styles.deviceIconMobile,
              ])}
            />
            <Kb.Text
              type={textType}
              style={Kb.Styles.collapseStyles([styles.instructions, styles.instructionsUpper])}
            >
              {p.otherDevice.name}, go to {p.otherDevice.type === 'desktop' && 'Devices'}
            </Kb.Text>
          </Kb.Box2>
          {p.otherDevice.type === 'mobile' && (
            <Kb.Box2
              alignItems="center"
              direction="horizontal"
              centerChildren={true}
              gap="xtiny"
              style={Kb.Styles.globalStyles.flexWrap}
            >
              <Kb.Icon
                type="iconfont-nav-2-hamburger"
                color={Kb.Styles.globalColors.white}
                sizeType="Default"
                style={styles.hamburger}
              />
              <Kb.Icon type="iconfont-arrow-right" color={Kb.Styles.globalColors.white} sizeType="Tiny" />
              <Kb.Text type={textType} style={styles.instructions}>
                Devices
              </Kb.Text>
            </Kb.Box2>
          )}
          <Kb.Text type={textType} style={styles.instructionsContainer} center={true}>
            <Kb.Text
              type={textType}
              style={Kb.Styles.collapseStyles([styles.instructions, styles.instructionsUpper])}
            >
              {`and authorize a new ${p.currentDevice.type === 'desktop' ? 'computer' : 'phone'}.`}
            </Kb.Text>
          </Kb.Text>
        </>
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      backButton: Kb.Styles.platformStyles({
        isElectron: {
          alignSelf: 'flex-start',
          marginTop: 56, // we're under the header, need to shift down
          paddingBottom: Kb.Styles.globalMargins.small,
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          position: 'relative', // otherwise the absolutely positioned background makes this unclickable
          zIndex: undefined, // annoyingly this is set inside Kb.BackButton
        },
        isMobile: {
          marginBottom: 0,
          marginLeft: 0,
          marginTop: 0,
        },
      }),
      backButtonText: {
        color: Kb.Styles.globalColors.white,
      },
      backgroundOnLeft: {
        marginLeft: -230,
      },
      backgroundOnRight: {
        marginRight: -230,
      },
      closeButton: {
        marginLeft: Kb.Styles.globalMargins.small,
        marginRight: Kb.Styles.globalMargins.small,
      },
      codePageContainer: Kb.Styles.platformStyles({
        common: {
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
        },
      }),
      container: Kb.Styles.platformStyles({
        common: {
          justifyContent: 'space-between',
        },
        isElectron: {
          height: '100%',
          padding: Kb.Styles.globalMargins.large,
        },
        isMobile: {
          flexGrow: 1,
          paddingBottom: Kb.Styles.globalMargins.small,
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
          paddingTop: Kb.Styles.globalMargins.small,
        },
      }),
      deviceIcon: {
        height: 32,
        width: 32,
      },
      deviceIconDesktop: {
        marginLeft: Kb.Styles.globalMargins.xtiny,
        marginRight: Kb.Styles.globalMargins.xxtiny,
      },
      deviceIconMobile: {
        marginLeft: Kb.Styles.globalMargins.xxtiny,
        marginRight: 0,
      },
      enterTextButton: {
        marginLeft: Kb.Styles.globalMargins.small,
        marginRight: Kb.Styles.globalMargins.small,
        maxWidth: Kb.Styles.isMobile ? undefined : 460,
        width: '90%',
      },
      enterTextContainer: {
        alignItems: Kb.Styles.isMobile ? 'stretch' : 'center',
        alignSelf: 'stretch',
      },
      enterTextInput: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.fontTerminalSemibold,
          backgroundColor: Kb.Styles.globalColors.white,
          borderRadius: 4,
          color: Kb.Styles.globalColors.greenDark,
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
      flexWrap: Kb.Styles.platformStyles({isMobile: {flexWrap: 'wrap'}}),
      hamburger: Kb.Styles.platformStyles({
        isMobile: {
          bottom: 1,
          marginRight: Kb.Styles.globalMargins.xtiny,
          position: 'relative',
          right: 1,
        },
      }),
      imageContainerOnLeft: {
        ...Kb.Styles.globalStyles.fillAbsolute,
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'flex-start',
        justifyContent: 'center',
      },
      imageContainerOnRight: {
        ...Kb.Styles.globalStyles.fillAbsolute,
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'flex-end',
        justifyContent: 'center',
      },
      instructions: {
        color: Kb.Styles.globalColors.white,
      },
      instructionsContainer: {
        padding: Kb.Styles.globalMargins.tiny,
      },
      instructionsUpper: {
        marginBottom: Kb.Styles.globalMargins.tiny,
      },
      qrContainer: Kb.Styles.platformStyles({
        common: {
          // MUST be white, else darkmode messes up the qr code
          backgroundColor: Kb.Styles.globalColors.whiteOrWhite,
          borderRadius: C.isAndroid ? 0 : 8, // If this is set to ANYTHING other than 0 android DOESN"T WORK!!!!!! The qr scanner totally breaks
          flexDirection: 'column',
          padding: 4,
        },
        isElectron: {
          width: 220,
        },
        isMobile: {
          width: 160,
        },
      }),
      qrContainerFlip: {
        flexDirection: 'column-reverse',
      },
      qrImageContainer: {
        paddingBottom: 10,
        paddingTop: 10,
      },
      qrOnlyContainer: {
        backgroundColor: Kb.Styles.globalColors.whiteOrWhite,
        borderRadius: 8,
        padding: 20,
      },
      scrollContainer: {
        flexGrow: 1,
        position: 'relative',
      },
      switchTab: {
        marginBottom: Kb.Styles.globalMargins.xtiny,
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      switchTabContainer: {
        alignItems: 'center',
      },
      viewTextCode: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.fontTerminalSemibold,
          color: Kb.Styles.globalColors.greenLight,
          fontSize: 16,
        },
        isElectron: {
          maxWidth: 330,
        },
      }),
      viewTextContainer: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.greenDark,
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
    }) as const
)
export default CodePage2
