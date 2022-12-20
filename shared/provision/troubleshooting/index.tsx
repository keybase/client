import * as React from 'react'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as DevicesConstants from '../../constants/devices'
import type * as Types from '../../constants/types/devices'
import * as ProvisionGen from '../../actions/provision-gen'
type Props = {
  mode: 'QR' | 'text'
  onCancel: () => void
  otherDeviceType: Types.DeviceType
}

type BigButtonProps = {
  icon: Kb.IconType
  mainText: string
  onClick: () => void
  subText: string
  waiting: boolean
}

const BigButton = ({onClick, icon, mainText, subText, waiting}: BigButtonProps) => (
  <Kb.ClickableBox onClick={waiting ? undefined : onClick}>
    <Kb.Box2
      direction={Styles.isMobile ? 'horizontal' : 'vertical'}
      style={styles.bigButton}
      className="hover_background_color_blueLighter2"
    >
      <Kb.Box2
        direction="horizontal"
        centerChildren={true}
        style={Styles.collapseStyles([styles.buttonIcon, waiting && Styles.globalStyles.opacity0])}
        gap="tiny"
      >
        <Kb.Icon type={icon} sizeType="Big" color={Styles.globalColors.blue} />
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        style={Styles.collapseStyles([styles.buttonText, waiting && Styles.globalStyles.opacity0])}
      >
        <Kb.Text type="Body">{mainText}</Kb.Text>
        <Kb.Text type="BodySmall">{subText}</Kb.Text>
      </Kb.Box2>
      {waiting && (
        <Kb.Box2 direction="vertical" style={styles.bigButtonWaiting} centerChildren={true}>
          <Kb.ProgressIndicator />
        </Kb.Box2>
      )}
    </Kb.Box2>
  </Kb.ClickableBox>
)

const Troubleshooting = (props: Props) => {
  const dispatch = Container.useDispatch()
  const [waiting, setWaiting] = React.useState(false)
  const onBack = props.onCancel
  const username = Container.useSelector(state => state.provision.username)
  const onWayBack = React.useCallback(() => {
    dispatch(ProvisionGen.createBackToDeviceList({username}))
    setWaiting(true)
  }, [dispatch, username])

  const device = Container.useSelector(state => state.provision.codePageOtherDevice)
  const deviceIconNo = (device.deviceNumberOfType % DevicesConstants.numBackgrounds) + 1

  // If we can't load the device icon, show the wrong one instead of erroring the whole page.
  const otherDeviceIcon = `icon-${props.otherDeviceType === 'mobile' ? 'phone' : 'computer'}-background-${
    deviceIconNo === -1 ? 1 : deviceIconNo
  }-64` as Kb.IconType

  return (
    <Kb.Modal
      onClose={onBack}
      header={{
        hideBorder: false,
        leftButton: Styles.isMobile ? (
          <Kb.Text type="BodySemiboldLink" onClick={onBack}>
            Back
          </Kb.Text>
        ) : null,
        title: 'Troubleshooting',
      }}
      footer={
        Styles.isMobile
          ? undefined
          : {
              content: <Kb.Button label="Cancel" onClick={onBack} type="Dim" fullWidth={true} />,
              hideBorder: true,
            }
      }
      mobileStyle={styles.mobileModal}
      mode="Wide"
    >
      <Kb.Box2 direction="vertical" gap="small" alignItems="center">
        <Kb.Box2 direction="vertical" style={styles.bodyMargins}>
          <Kb.Text type="Body" center={true}>
            This appears to be a new {Styles.isMobile ? 'phone' : 'computer'}. Perhaps you restored from a
            backup or uninstalled Keybase. Either way, Keybase keys aren’t backed up, so this is now a totally
            new device.
          </Kb.Text>
          <Kb.Text type="Body" center={true}>
            How do you want to proceed?
          </Kb.Text>
        </Kb.Box2>
        <Kb.Box2
          direction={Styles.isMobile ? 'vertical' : 'horizontal'}
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
            waiting={waiting}
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}
export default Troubleshooting

const styles = Styles.styleSheetCreate(() => ({
  bigButton: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      borderColor: Styles.globalColors.black_10,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
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
    ...Styles.globalStyles.fillAbsolute,
    backgroundColor: Styles.globalColors.white_40,
  },
  bodyMargins: Styles.platformStyles({
    isElectron: Styles.padding(Styles.globalMargins.medium, Styles.globalMargins.xlarge, 0),
    isMobile: {
      padding: Styles.globalMargins.medium,
    },
  }),
  buttonBar: {
    marginLeft: Styles.globalMargins.medium,
    marginRight: Styles.globalMargins.medium,
  },
  buttonIcon: {
    height: 64,
    paddingRight: Styles.globalMargins.small,
    width: 64,
  },
  buttonText: Styles.platformStyles({
    isElectron: {
      textAlign: 'center',
    },
    isMobile: {
      maxWidth: 188,
    },
  }),
  mobileModal: {
    backgroundColor: Styles.globalColors.white,
  },
}))
