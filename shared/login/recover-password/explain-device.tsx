import * as C from '../../constants'
import * as Kb from '../../common-adapters'
import * as T from '../../constants/types'
import type {ButtonType} from '../../common-adapters/button'
import {SignupScreen} from '../../signup/common'
import {globalColors} from '../../styles'

const ConnectedExplainDevice = () => {
  const ed = C.useRecoverState(s => s.explainedDevice)
  const deviceName = ed ? ed.name : ''
  const deviceType = ed ? ed.type : undefined
  const username = C.useRecoverState(s => s.username)
  const startRecoverPassword = C.useRecoverState(s => s.dispatch.startRecoverPassword)
  const onBack = () => {
    startRecoverPassword({
      replaceRoute: true,
      username,
    })
  }
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onComplete = () => {
    navigateUp()
  }
  const props = {
    deviceName,
    deviceType,
    onBack,
    onComplete,
    username,
  }
  return <ExplainDevice {...props} />
}

export default ConnectedExplainDevice

export type Props = {
  deviceName: string
  deviceType?: T.RPCGen.DeviceType
  onBack: () => void
  onComplete: () => void
}

const ExplainDevice = (props: Props) => {
  const explainingMobile = props.deviceType === T.RPCGen.DeviceType.mobile

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
