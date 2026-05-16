import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type {ButtonType} from '@/common-adapters/button'
import {SignupScreen} from '@/signup/common'
import {startRecoverPassword} from './flow'

type Props = {route: {params: {deviceName: string; deviceType: T.RPCGen.DeviceType; username: string}}}

const ConnectedExplainDevice = ({route}: Props) => {
  const {deviceName, deviceType, username} = route.params
  const onBack = () => {
    startRecoverPassword({
      replaceRoute: true,
      username,
    })
  }
  const navigateUp = C.Router2.navigateUp
  const onComplete = () => {
    navigateUp()
  }

  const explainingMobile = deviceType === T.RPCGen.DeviceType.mobile

  return (
    <SignupScreen
      buttons={[
        {
          label: 'Got it',
          onClick: onComplete,
          type: 'Default' as ButtonType,
        },
      ]}
      noBackground={true}
      onBack={onBack}
      title="Recover password"
    >
      <Kb.Box2 alignItems="center" direction="vertical" fullHeight={true} fullWidth={true} gap="small">
        <Kb.ImageIcon type={explainingMobile ? 'icon-phone-96' : 'icon-computer-96'} />
        <Kb.Box2 alignItems="center" direction="vertical">
          <Kb.Text type="Body">
            On <Kb.Text type="BodySemiboldItalic">{deviceName}</Kb.Text>, go to
          </Kb.Text>
          <Kb.Box2 direction="horizontal" alignItems="center" gap="xtiny">
            {explainingMobile ? (
              <Kb.Icon type="iconfont-nav-2-hamburger" color={Kb.Styles.globalColors.black} />
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

export default ConnectedExplainDevice
