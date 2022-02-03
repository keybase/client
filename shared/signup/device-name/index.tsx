import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/provision'
import * as Styles from '../../styles'
import * as Platform from '../../constants/platform'
import {SignupScreen, errorBanner, InfoIcon} from '../common'
import debounce from 'lodash/debounce'

type Props = {
  error: string
  initialDevicename?: string
  onBack: () => void
  onContinue: (devicename: string) => void
  waiting: boolean
}

const EnterDevicename = (props: Props) => {
  const [deviceName, setDeviceName] = React.useState(props.initialDevicename || '')
  const [readyToShowError, setReadyToShowError] = React.useState(false)
  const debouncedSetReadyToShowError = debounce(ready => setReadyToShowError(ready), 1000)
  const cleanDeviceName = Constants.cleanDeviceName(deviceName)
  const normalized = cleanDeviceName.replace(Constants.normalizeDeviceRE, '')
  const disabled =
    normalized.length < 3 ||
    normalized.length > 64 ||
    !Constants.goodDeviceRE.test(cleanDeviceName) ||
    Constants.badDeviceRE.test(cleanDeviceName)
  const showDisabled = disabled && !!cleanDeviceName && readyToShowError
  const _setDeviceName = (deviceName: string) => {
    setReadyToShowError(false)
    setDeviceName(deviceName.replace(Constants.badDeviceChars, ''))
    debouncedSetReadyToShowError(true)
  }
  const onContinue = () => (disabled ? {} : props.onContinue(cleanDeviceName))
  return (
    <SignupScreen
      banners={errorBanner(props.error)}
      buttons={[{disabled, label: 'Continue', onClick: onContinue, type: 'Success', waiting: props.waiting}]}
      onBack={props.onBack}
      title={Styles.isMobile ? 'Name this device' : 'Name this computer'}
    >
      <Kb.Box2
        alignItems="center"
        direction="vertical"
        gap={Styles.isMobile ? 'small' : 'medium'}
        fullWidth={true}
        style={Styles.globalStyles.flexOne}
      >
        <Kb.Icon
          type={
            Styles.isMobile
              ? Platform.isLargeScreen
                ? 'icon-phone-background-1-96'
                : 'icon-phone-background-1-64'
              : 'icon-computer-background-1-96'
          }
        />
        <Kb.Box2 direction="vertical" fullWidth={Styles.isPhone} gap="tiny">
          <Kb.LabeledInput
            autoFocus={true}
            containerStyle={styles.input}
            error={showDisabled}
            maxLength={64}
            placeholder={Styles.isMobile ? 'Phone 1' : 'Computer 1'}
            onChangeText={_setDeviceName}
            onEnterKeyDown={onContinue}
            value={cleanDeviceName}
          />
          {showDisabled && readyToShowError ? (
            <Kb.Text type="BodySmall" style={styles.deviceNameError}>
              {Constants.deviceNameInstructions}
            </Kb.Text>
          ) : (
            <Kb.Text type="BodySmall">
              Your device name will be public and can not be changed in the future.
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}
EnterDevicename.navigationOptions = {
  header: null,
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

const styles = Styles.styleSheetCreate(() => ({
  deviceNameError: {
    color: Styles.globalColors.redDark,
    marginLeft: 2,
  },
  input: Styles.platformStyles({
    isElectron: {width: 368},
    isTablet: {width: 368},
  }),
}))

export default EnterDevicename
