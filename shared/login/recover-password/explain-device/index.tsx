import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import {globalColors} from '../../../styles'
import {SignupScreen, InfoIcon} from '../../../signup/common'
import type {ButtonType} from '../../../common-adapters/button'

export type Props = {
  deviceName: string
  deviceType?: RPCTypes.DeviceType
  onBack: () => void
  onComplete: () => void
}

const ExplainDevice = (props: Props) => {
  const explainingMobile = props.deviceType === RPCTypes.DeviceType.mobile

  return (
    <SignupScreen
      buttons={[
        {
          label: 'Got it',
          onClick: props.onComplete,
          type: 'Default' as ButtonType,
        },
      ]}
      noBackground={true}
      onBack={props.onBack}
      title="Recover password"
    >
      <Kb.Box2 alignItems="center" direction="vertical" fullHeight={true} fullWidth={true} gap="small">
        <Kb.Icon type={explainingMobile ? 'icon-phone-96' : 'icon-computer-96'} />
        <Kb.Box2 alignItems="center" direction="vertical">
          <Kb.Text type="Body">
            On <Kb.Text type="BodySemiboldItalic">{props.deviceName}</Kb.Text>, go to
          </Kb.Text>
          <Kb.Box2 direction="horizontal" alignItems="center" gap="xtiny">
            {explainingMobile ? (
              <Kb.Icon type="iconfont-nav-2-hamburger" color={globalColors.black} />
            ) : (
              <Kb.Text type="Body">Settings</Kb.Text>
            )}
            <Kb.Text type="Body">{`> Your account, and change your`}</Kb.Text>
          </Kb.Box2>
          <Kb.Text type="Body">password.</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

ExplainDevice.navigationOptions = {
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2
      direction="horizontal"
      style={Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0)}
    >
      <InfoIcon />
    </Kb.Box2>
  ),
}

export default ExplainDevice
