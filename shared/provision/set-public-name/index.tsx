import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/provision'
import {globalMargins, styleSheetCreate, isMobile, platformStyles} from '../../styles'
import {SignupScreen, errorBanner} from '../../signup/common'

type Props = {
  onBack: () => void
  onSubmit: (name: string) => void
  error: string
  waiting: boolean
}

const SetPublicName = (props: Props) => {
  const [deviceName, setDeviceName] = React.useState('')
  const cleanDeviceName = Constants.cleanDeviceName(deviceName)
  const _onSubmit = props.onSubmit
  const onSubmit = React.useCallback(() => {
    _onSubmit(Constants.cleanDeviceName(cleanDeviceName))
  }, [cleanDeviceName, _onSubmit])

  return (
    <SignupScreen
      banners={errorBanner(props.error)}
      buttons={[
        {
          disabled: deviceName.length < 3 || deviceName.length > 64,
          label: 'Continue',
          onClick: onSubmit,
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
            onEnterKeyDown={onSubmit}
            onChangeText={setDeviceName}
            value={cleanDeviceName}
            style={styles.nameInput}
          />
          <Kb.Text type="BodySmall">Your device name will be public.</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = styleSheetCreate(() => ({
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
      width: 400,
    },
    isMobile: {
      width: '100%',
    },
  }),
}))

SetPublicName.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
}

export default SetPublicName
