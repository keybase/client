import * as React from 'react'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as DevicesConstants from '../../constants/devices'
import * as DeviceTypes from '../../constants/types/devices'
import * as ProvisionGen from '../../actions/provision-gen'
type Props = {
  mode: 'QR' | 'text'
  onCancel: () => void
}

type BigButtonProps = {
  icon: Kb.IconType
  mainText: string
  onClick: () => void
  subText: string
}

const BigButton = ({onClick, icon, mainText, subText}: BigButtonProps) => (
  <Kb.ClickableBox onClick={onClick}>
    <Kb.Box2
      direction={Styles.isMobile ? 'horizontal' : 'vertical'}
      style={styles.bigButton}
      className="hover_background_color_blueLighter2"
    >
      <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.buttonIcon} gap="tiny">
        <Kb.Icon type={icon} sizeType="Big" color={Styles.globalColors.blue} />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" style={styles.buttonText}>
        <Kb.Text type="Body" center={true}>
          {mainText}
        </Kb.Text>
        <Kb.Text type="BodySmall" center={true}>
          {subText}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  </Kb.ClickableBox>
)

const Troubleshooting = (props: Props) => {
  const dispatch = Container.useDispatch()
  const onBack = props.onCancel
  const username = Container.useSelector(state => state.provision.username)
  const onWayBack = React.useCallback(() => {
    dispatch(ProvisionGen.createSubmitUsername({username}))
  }, [username])

  const deviceName = Container.useSelector(state => state.provision.codePageOtherDeviceName)
  const deviceMap: Map<string, DeviceTypes.Device> = Container.useSelector(state => state.devices.deviceMap)
  const deviceId = Container.useSelector(state => state.provision.codePageOtherDeviceId)
  const deviceIconNo = DevicesConstants.getDeviceIconNumberInner(deviceMap, deviceId)

  return (
    <Kb.Modal
      onClose={onBack}
      header={{
        hideBorder: true,
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
      mode="Wide"
    >
      <Kb.Box2 direction="vertical" gap="small" alignItems="center">
        <Kb.Box2 direction="vertical">
          <Kb.Text type="Body" center={true} style={styles.bodyMargins}>
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
            mainText={`I have my old "${deviceName}," let me use it to authorize.`}
            subText={`Back to ${props.mode} code`}
          />
          <BigButton
            onClick={onWayBack}
            icon="iconfont-reply"
            mainText="I'll use a different device, or reset my account."
            subText="Back to list"
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
    },
    isElectron: {
      maxWidth: 252,
      minHeight: 157,
    },
    isMobile: {
      width: 292,
    },
  }),
  bodyMargins: Styles.platformStyles({
    isElectron: Styles.padding(Styles.globalMargins.medium, Styles.globalMargins.xlarge, 0),
    isMobile: Styles.padding(Styles.globalMargins.medium),
  }),
  buttonBar: {
    marginLeft: Styles.globalMargins.medium,
    marginRight: Styles.globalMargins.medium,
  },
  buttonIcon: {
    height: 72,
    width: 72,
  },
  buttonText: Styles.platformStyles({
    isMobile: {
      maxWidth: 188,
    },
  }),
}))
