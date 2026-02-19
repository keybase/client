import * as C from '@/constants'
import * as Devices from '@/stores/devices'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import QRImage from './qr-image'
import QRScan from './qr-scan'
import Troubleshooting from '../troubleshooting'
import type * as T from '@/constants/types'
import {useCurrentUserState} from '@/stores/current-user'
import {type Device, useProvisionState} from '@/stores/provision'

const CodePageContainer = () => {
  const {deviceID, storeDeviceName} = useCurrentUserState(
    C.useShallow(s => ({
      deviceID: s.deviceID,
      storeDeviceName: s.deviceName,
    }))
  )
  const currentDeviceAlreadyProvisioned = !!storeDeviceName
  const provisionState = useProvisionState(
    C.useShallow(s => ({
      error: s.error,
      otherDevice: s.codePageOtherDevice,
      provisionDeviceName: s.deviceName,
      submitTextCode: s.dispatch.dynamic.submitTextCode,
      textCode: s.codePageIncomingTextCode,
    }))
  )
  const {error, otherDevice, provisionDeviceName, submitTextCode, textCode} = provisionState
  const currentDeviceName = currentDeviceAlreadyProvisioned ? storeDeviceName : provisionDeviceName
  const currentDevice = Devices.useDevicesState(s => s.deviceMap.get(deviceID)) ?? Devices.emptyDevice
  const iconNumber = Devices.useDeviceIconNumber(otherDevice.id)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvision)

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = navigateUp

  const _onSubmitTextCode = React.useCallback(
    (code: string) => {
      !waiting && submitTextCode?.(code)
    },
    [submitTextCode, waiting]
  )

  const [code, setCode] = React.useState('')
  const [troubleshooting, setTroubleshooting] = React.useState(false)

  const defaultTab = React.useMemo(() => {
    const getTabOrOpposite = (tabToShowToNew: Tab) => {
      if (!currentDeviceAlreadyProvisioned) return tabToShowToNew
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
        return otherDevice.type === 'desktop' ? getTabOrOpposite('viewText') : getTabOrOpposite('QR')
    }
  }, [currentDeviceAlreadyProvisioned, otherDevice.type])

  const [tab, setTab] = React.useState<Tab>(defaultTab)

  React.useEffect(() => {
    setTab(defaultTab)
  }, [defaultTab])

  const tabBackground = () => (tab === 'QR' ? Kb.Styles.globalColors.blueLight : Kb.Styles.globalColors.green)
  const buttonBackground = () => (tab === 'QR' ? 'blue' : 'green')

  const onSubmitTextCode = () => _onSubmitTextCode(code)

  const header = () => {
    return Kb.Styles.isMobile
      ? {
          leftButton: (
            <Kb.Text type="BodyBig" onClick={onBack} negative={true}>
              {currentDeviceAlreadyProvisioned ? 'Back' : 'Cancel'}
            </Kb.Text>
          ),
          style: {backgroundColor: tabBackground()},
        }
      : undefined
  }

  const body = () => {
    let content: React.ReactNode = null
    switch (tab) {
      case 'QR':
        content = <Qr textCode={textCode} currentDeviceAlreadyProvisioned={currentDeviceAlreadyProvisioned} />
        break
      case 'viewText':
        content = <ViewText textCode={textCode} />
        break
      case 'enterText':
        content = (
          <EnterText
            code={code}
            setCode={setCode}
            onSubmitTextCode={onSubmitTextCode}
            otherDevice={otherDevice}
          />
        )
        break
      default:
    }
    return (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([styles.codePageContainer, {backgroundColor: tabBackground()}])}
      >
        <Kb.Box2
          direction="vertical"
          fullHeight={true}
          style={currentDeviceAlreadyProvisioned ? styles.imageContainerOnLeft : styles.imageContainerOnRight}
        >
          <Kb.Icon
            type={tab === 'QR' ? 'illustration-bg-provisioning-blue' : 'illustration-bg-provisioning-green'}
            style={currentDeviceAlreadyProvisioned ? styles.backgroundOnLeft : styles.backgroundOnRight}
          />
        </Kb.Box2>
        {!currentDeviceAlreadyProvisioned && !Kb.Styles.isMobile && (
          <>
            <Kb.BackButton
              onClick={onBack}
              iconColor={Kb.Styles.globalColors.white}
              style={styles.backButton}
              textStyle={styles.backButtonText}
            />
            <Kb.Divider />
          </>
        )}
        {!!error && <Kb.Banner color="red">{error}</Kb.Banner>}
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.scrollContainer}>
          <Kb.Box2 direction="vertical" fullHeight={true} style={Kb.Styles.globalStyles.flexGrow}>
            <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} gap="tiny">
              <Instructions
                currentDeviceAlreadyProvisioned={currentDeviceAlreadyProvisioned}
                currentDevice={currentDevice}
                currentDeviceName={currentDeviceName}
                otherDevice={otherDevice}
                iconNumber={iconNumber}
              />
              {content}
              <SwitchTab
                selected={tab}
                onSelect={setTab}
                otherDevice={otherDevice}
                currentDeviceAlreadyProvisioned={currentDeviceAlreadyProvisioned}
              />
              {!inModal() && footer().content}
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
        {!inModal() &&
          currentDeviceType === 'desktop' &&
          currentDeviceType === otherDevice.type &&
          !currentDeviceAlreadyProvisioned &&
          heyWaitBanner()}
        {!inModal() && troubleshooting && (
          <Kb.Overlay onHidden={() => setTroubleshooting(false)} propagateOutsideClicks={true}>
            {troubleshootingContent()}
          </Kb.Overlay>
        )}
      </Kb.Box2>
    )
  }

  const footer = () => {
    const showHeyWaitInFooter =
      currentDeviceType === 'mobile' &&
      currentDeviceType === otherDevice.type &&
      !currentDeviceAlreadyProvisioned
    return {
      content: (
        <Kb.Box2
          alignItems="center"
          direction="vertical"
          gap={Kb.Styles.isMobile ? 'medium' : 'small'}
          gapEnd={!showHeyWaitInFooter}
          fullWidth={true}
        >
          {tab === 'enterText' && (
            <Kb.WaitingButton
              fullWidth={true}
              backgroundColor={buttonBackground()}
              label="Continue"
              onClick={onSubmitTextCode}
              disabled={!code || waiting}
              style={styles.enterTextButton}
              waitingKey={C.waitingKeyProvision}
            />
          )}
          {tab !== 'enterText' && inModal() && !Kb.Styles.isMobile && (
            <Kb.WaitingButton
              fullWidth={true}
              backgroundColor={buttonBackground()}
              label="Close"
              onClick={onBack}
              onlyDisable={true}
              style={styles.closeButton}
              waitingKey={C.waitingKeyProvision}
            />
          )}
          {showHeyWaitInFooter && heyWaitBanner()}
        </Kb.Box2>
      ),
      hideBorder: !inModal() || currentDeviceType !== 'desktop',
      style: {
        backgroundColor: tabBackground(),
        ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, 0, 0),
      },
    }
  }

  const heyWaitBanner = () => (
    <Kb.ClickableBox onClick={() => setTroubleshooting(true)}>
      <Kb.Banner color="yellow">
        <Kb.BannerParagraph
          bannerColor="yellow"
          content={[
            `Are you on that ${otherDevice.type === 'mobile' ? 'phone' : 'computer'} now? `,
            {onClick: () => setTroubleshooting(true), text: 'Resolve'},
          ]}
        />
      </Kb.Banner>
    </Kb.ClickableBox>
  )

  const troubleshootingContent = () => (
    <Troubleshooting
      mode={tab === 'QR' ? 'QR' : 'text'}
      onCancel={() => setTroubleshooting(false)}
      otherDeviceType={otherDevice.type}
    />
  )

  // We're in a modal unless this is a desktop being newly provisioned.
  const inModal = () => currentDeviceType !== 'desktop' || currentDeviceAlreadyProvisioned

  // Workaround for no modals while logged out: display just the troubleshooting modal if we're on mobile and it's open;
  // When we're on desktop being newly provisioned, it's in this._body()
  if (Kb.Styles.isMobile && troubleshooting) {
    return troubleshootingContent()
  }
  const content = body()
  if (inModal()) {
    return (
      <Kb.Modal
        header={header()}
        footer={footer()}
        onClose={onBack}
        mode="Wide"
        mobileStyle={{backgroundColor: tabBackground()}}
      >
        {content}
      </Kb.Modal>
    )
  }
  return content
}

export type DeviceType = 'mobile' | 'desktop'
export type Tab = 'QR' | 'enterText' | 'viewText'

const currentDeviceType: DeviceType = Kb.Styles.isMobile ? 'mobile' : 'desktop'

const textType = 'BodySemibold'

const SwitchTab = (props: {
  selected: Tab
  onSelect: (tab: Tab) => void
  otherDevice: Device
  currentDeviceAlreadyProvisioned: boolean
}) => {
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

const Qr = (props: {textCode: string; currentDeviceAlreadyProvisioned: boolean}) =>
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

const EnterText = (props: {
  code: string
  setCode: (code: string) => void
  onSubmitTextCode: (c: string) => void
  otherDevice: Device
}) => {
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

const ViewText = (props: {textCode: string}) => (
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

const Instructions = (p: {
  currentDeviceAlreadyProvisioned: boolean
  currentDevice: T.Devices.Device
  currentDeviceName: string
  otherDevice: Device
  iconNumber: T.Devices.IconNumber
}) => {
  const iconType = getIcon(
    p.currentDeviceAlreadyProvisioned ? p.currentDevice.type : p.otherDevice.type,
    p.iconNumber
  )

  let content: React.ReactNode

  const icon = (
    <Kb.Icon
      type={iconType}
      sizeType="Default"
      style={Kb.Styles.collapseStyles([
        styles.deviceIcon,
        p.currentDevice.type === 'desktop' && styles.deviceIconDesktop,
        p.currentDevice.type === 'mobile' && styles.deviceIconMobile,
      ])}
    />
  )

  if (p.currentDeviceAlreadyProvisioned) {
    content = (
      <Kb.Box2 alignItems="center" direction="horizontal" style={styles.flexWrap}>
        <Kb.Text type={textType} style={styles.instructions}>
          Ready to authorize using
        </Kb.Text>
        {icon}
        <Kb.Text type={textType} style={styles.instructions}>
          {p.currentDeviceName}.
        </Kb.Text>
      </Kb.Box2>
    )
  } else {
    const hamburger =
      p.otherDevice.type === 'mobile' ? (
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
      ) : null
    content = (
      <>
        <Kb.Box2 alignItems="flex-end" direction="horizontal" gap="xtiny">
          <Kb.Text
            type={textType}
            style={Kb.Styles.collapseStyles([styles.instructions, styles.instructionsUpper])}
          >
            On
          </Kb.Text>
          {icon}
          <Kb.Text
            type={textType}
            style={Kb.Styles.collapseStyles([styles.instructions, styles.instructionsUpper])}
          >
            {p.otherDevice.name}, go to {p.otherDevice.type === 'desktop' && 'Devices'}
          </Kb.Text>
        </Kb.Box2>
        {hamburger}
        <Kb.Text type={textType} style={styles.instructionsContainer} center={true}>
          <Kb.Text
            type={textType}
            style={Kb.Styles.collapseStyles([styles.instructions, styles.instructionsUpper])}
          >
            {`and authorize a new ${p.currentDevice.type === 'desktop' ? 'computer' : 'phone'}.`}
          </Kb.Text>
        </Kb.Text>
      </>
    )
  }

  return <Kb.Box2 direction="vertical">{content}</Kb.Box2>
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
      backButtonText: {color: Kb.Styles.globalColors.white},
      backgroundOnLeft: {marginLeft: -230},
      backgroundOnRight: {marginRight: -230},
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
        common: {justifyContent: 'space-between'},
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
        isMobile: {width: '100%'},
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
      instructions: {color: Kb.Styles.globalColors.white},
      instructionsContainer: {padding: Kb.Styles.globalMargins.tiny},
      instructionsUpper: {marginBottom: Kb.Styles.globalMargins.tiny},
      qrContainer: Kb.Styles.platformStyles({
        common: {
          // MUST be white, else darkmode messes up the qr code
          backgroundColor: Kb.Styles.globalColors.whiteOrWhite,
          borderRadius: C.isAndroid ? 0 : 8, // If this is set to ANYTHING other than 0 android DOESN"T WORK!!!!!! The qr scanner totally breaks
          flexDirection: 'column',
          padding: 4,
        },
        isElectron: {width: 220},
        isMobile: {width: 160},
      }),
      qrContainerFlip: {flexDirection: 'column-reverse'},
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
      switchTabContainer: {alignItems: 'center'},
      viewTextCode: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.fontTerminalSemibold,
          color: Kb.Styles.globalColors.greenLight,
          fontSize: 16,
        },
        isElectron: {maxWidth: 330},
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

export default CodePageContainer
