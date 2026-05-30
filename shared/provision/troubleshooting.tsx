import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useProvisionState} from '@/stores/provision'
type Props = {
  mode: 'QR' | 'text'
  onCancel: () => void
  otherDeviceType: T.Devices.DeviceType
}

type BigButtonProps = {
  icon: Kb.IconType
  mainText: string
  onClick: () => void
  subText: string
  waiting: boolean
}

const BigButton = ({onClick, icon, mainText, subText, waiting}: BigButtonProps) => (
  <Kb.ClickableBox3
    onClick={waiting ? undefined : onClick}
    direction={isMobile ? 'horizontal' : 'vertical'}
    style={styles.bigButton}
    className="hover_background_color_blueLighter2"
  >
      <Kb.Box2
        direction="horizontal"
        centerChildren={true}
        style={Kb.Styles.collapseStyles([styles.buttonIcon, waiting && Kb.Styles.globalStyles.opacity0])}
        gap="tiny"
      >
        <Kb.IconAuto type={icon} sizeType="Big" color={Kb.Styles.globalColors.blue} />
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([styles.buttonText, waiting && Kb.Styles.globalStyles.opacity0])}
      >
        <Kb.Text type="Body">{mainText}</Kb.Text>
        <Kb.Text type="BodySmall">{subText}</Kb.Text>
      </Kb.Box2>
      {waiting && (
        <Kb.Box2 direction="vertical" style={styles.bigButtonWaiting} centerChildren={true}>
          <Kb.ProgressIndicator />
        </Kb.Box2>
      )}
  </Kb.ClickableBox3>
)

const Troubleshooting = (props: Props) => {
  const onBack = props.onCancel
  const onWayBack = () => {
    C.Router2.navUpToScreen('login')
  }

  const device = useProvisionState(s => s.codePageOtherDevice)
  const deviceIconNo = T.Devices.deviceNumberToIconNumber(device.deviceNumberOfType)

  // If we can't load the device icon, show the wrong one instead of erroring the whole page.
  const otherDeviceIcon = `icon-${props.otherDeviceType === 'mobile' ? 'phone' : 'computer'}-background-${
    deviceIconNo
  }-64` as Kb.IconType

  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.header}>
        <Kb.Box2
          direction="horizontal"
          alignItems="center"
          fullHeight={true}
          style={Kb.Styles.globalStyles.flexOne}
        >
          <Kb.Box2 direction="horizontal" style={styles.headerSide}>
            {isMobile ? (
              <Kb.Text type="BodySemiboldLink" onClick={onBack}>
                Back
              </Kb.Text>
            ) : null}
          </Kb.Box2>
          <Kb.Text type={isMobile ? 'BodyBig' : 'Header'} lineClamp={1} center={true}>
            Troubleshooting
          </Kb.Text>
          <Kb.Box2 direction="horizontal" style={styles.headerSide} />
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" gap="small" alignItems="center">
        <Kb.Box2 direction="vertical" style={styles.bodyMargins}>
          <Kb.Text type="Body" center={true}>
            This appears to be a new {isMobile ? 'phone' : 'computer'}. Perhaps you restored from a
            {
              "backup or uninstalled Keybase. Either way, Keybase keys aren't backed up, so this is now a totally"
            }
            new device.
          </Kb.Text>
          <Kb.Text type="Body" center={true}>
            How do you want to proceed?
          </Kb.Text>
        </Kb.Box2>
        <Kb.Box2
          direction={isMobile ? 'vertical' : 'horizontal'}
          style={styles.buttonBar}
          gap="xsmall"
        >
          <BigButton
            onClick={onBack}
            icon={otherDeviceIcon}
            mainText={`I have my old "${device.name}," let me use it to authorize.`}
            subText={`Back to ${props.mode} code`}
            waiting={false}
          />
          <BigButton
            onClick={onWayBack}
            icon="iconfont-reply"
            mainText="I'll use a different device, or reset my account."
            subText="Back to list"
            waiting={false}
          />
        </Kb.Box2>
      </Kb.Box2>
      {!isMobile && (
        <Kb.Box2
          direction="vertical"
          centerChildren={true}
          fullWidth={true}
          style={styles.modalFooterNoBorder}
        >
          <Kb.Button label="Cancel" onClick={onBack} type="Dim" fullWidth={true} />
        </Kb.Box2>
      )}
    </>
  )
}
export default Troubleshooting

const styles = Kb.Styles.styleSheetCreate(() => ({
  bigButton: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      ...Kb.Styles.border(Kb.Styles.globalColors.black_10, 1, Kb.Styles.borderRadius),
      position: 'relative',
    },
    isElectron: {
      maxWidth: 252,
      minHeight: 157,
    },
    isMobile: {
      width: '100%',
    },
  }),
  bigButtonWaiting: {
    ...Kb.Styles.globalStyles.fillAbsolute,
    backgroundColor: Kb.Styles.globalColors.white_40,
  },
  bodyMargins: Kb.Styles.platformStyles({
    isElectron: Kb.Styles.padding(Kb.Styles.globalMargins.medium, Kb.Styles.globalMargins.xlarge, 0),
    isMobile: {
      padding: Kb.Styles.globalMargins.medium,
    },
  }),
  buttonBar: {
    ...Kb.Styles.marginH(Kb.Styles.globalMargins.medium),
  },
  buttonIcon: {
    ...Kb.Styles.size(64),
    paddingRight: Kb.Styles.globalMargins.small,
  },
  buttonText: Kb.Styles.platformStyles({
    isElectron: {
      textAlign: 'center',
    },
    isMobile: {
      maxWidth: 188,
    },
  }),
  header: {
    ...Kb.Styles.bottomDivider(48),
  },
  headerSide: {
    flex: 1,
    ...Kb.Styles.paddingH(Kb.Styles.globalMargins.xsmall),
  },
  modalFooterNoBorder: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      minHeight: 56,
    },
    isElectron: {
      ...Kb.Styles.roundedBottom(),
    },
  }),
}))
