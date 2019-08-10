import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {globalColors} from '../../../styles'
import {SignupScreen} from '../../../signup/common'
import {ButtonType} from '../../../common-adapters/button'

export type Props = {
  deviceName: string
  deviceType: string
  onBack: () => void
  onComplete: () => void
}

const ExplainDevice = (props: Props) => {
  const isMobile = props.deviceType === 'mobile'

  return (
    <SignupScreen
      banners={[]}
      buttons={[
        {
          label: 'Got it',
          onClick: props.onComplete,
          type: 'Default' as ButtonType,
        },
      ]}
      onBack={props.onBack}
      title="Recover password"
    >
      <Kb.Box2 alignItems="center" direction="vertical" fullHeight={true} fullWidth={true} gap="small">
        <Kb.Icon type={isMobile ? 'icon-phone-96' : 'icon-computer-96'} />
        <Kb.Box2 alignItems="center" direction="vertical">
          <Kb.Text type="Body">
            On <Kb.Text type="BodySemiboldItalic">{props.deviceName}</Kb.Text>, go to
          </Kb.Text>
          <Kb.Box2 direction="horizontal" alignItems="center" gap="xtiny">
            {isMobile ? (
              <Kb.Icon type="iconfont-nav-more" color={globalColors.black} />
            ) : (
              <Kb.Text type="Body">Settings</Kb.Text>
            )}
            <Kb.Text type="Body">> Your account, and change your</Kb.Text>
          </Kb.Box2>
          <Kb.Text type="Body">password.</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

export default ExplainDevice
