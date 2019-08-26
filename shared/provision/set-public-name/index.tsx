import * as React from 'react'
import * as Kb from '../../common-adapters'
import {globalMargins, styleSheetCreate, isMobile, platformStyles} from '../../styles'
import {SignupScreen, errorBanner} from '../../signup/common'

type Props = {
  onBack: () => void
  onChange: (deviceName: string) => void
  onSubmit: () => void | void
  deviceName: string
  error: string
  waiting: boolean
}

const SetPublicName = (props: Props) => {
  return (
    <SignupScreen
      banners={errorBanner(props.error)}
      buttons={[
        {
          disabled: !props.onSubmit,
          label: 'Continue',
          onClick: props.onSubmit,
          type: 'Success',
          waiting: props.waiting,
        },
      ]}
      onBack={props.onBack}
      title={`Name this ${isMobile ? 'phone' : 'computer'}`}
    >
      <Kb.Box2 direction="vertical" style={styles.contents} centerChildren={true} gap="medium">
        <Kb.Icon type={isMobile ? 'icon-phone-96' : 'icon-computer-96'} />
        <Kb.Box2 direction="vertical" style={styles.wrapper} gap="xsmall">
          <Kb.NewInput
            autoFocus={true}
            placeholder="Pick a device name"
            onEnterKeyDown={props.onSubmit}
            onChangeText={props.onChange}
            value={props.deviceName}
            style={styles.nameInput}
          />
          <Kb.Text type="BodySmall">Your device name will be public.</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = styleSheetCreate({
  backButton: platformStyles({
    isElectron: {
      marginLeft: globalMargins.medium,
      marginTop: globalMargins.medium,
    },
    isMobile: {
      marginLeft: 0,
      marginTop: 0,
    },
  }),
  contents: {
    width: '100%',
  },
  nameInput: platformStyles({
    common: {
      padding: globalMargins.tiny,
    },
    isMobile: {
      minHeight: 48,
    },
  }),
  wrapper: platformStyles({
    isElectron: {
      width: 460,
    },
    isMobile: {
      width: '100%',
    },
  }),
})

export default SetPublicName
