import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/provision'
import * as Styles from '../../styles'
import * as Platform from '../../constants/platform'
import {defaultDevicename} from '../../constants/signup'
import debounce from 'lodash/debounce'
import flags from '../../util/feature-flags'

import {SignupScreen, errorBanner} from '../../signup/common'

type Props = {
  onBack: () => void
  onSubmit: (name: string) => void
  deviceIconNumber: number
  error: string
  waiting: boolean
}

const SetPublicName = (props: Props) => {
  const [deviceName, setDeviceName] = React.useState(defaultDevicename)
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
  const _onSubmit = props.onSubmit
  const onSubmit = React.useCallback(() => {
    _onSubmit(Constants.cleanDeviceName(cleanDeviceName))
  }, [cleanDeviceName, _onSubmit])
  const _setDeviceName = (deviceName: string) => {
    setReadyToShowError(false)
    setDeviceName(deviceName.replace(Constants.badDeviceChars, ''))
    debouncedSetReadyToShowError(true)
  }

  const maybeIcon = Styles.isMobile
    ? Platform.isLargeScreen
      ? `icon-phone-background-${props.deviceIconNumber}-96`
      : `icon-phone-background-${props.deviceIconNumber}-64`
    : `icon-computer-background-${props.deviceIconNumber}-96`

  const defaultIcon = Styles.isMobile
    ? Platform.isLargeScreen
      ? `icon-phone-96`
      : `icon-phone-64`
    : `icon-computer-96`

  return (
    <SignupScreen
      banners={errorBanner(props.error)}
      buttons={[
        {
          disabled,
          label: 'Continue',
          onClick: onSubmit,
          type: 'Success',
          waiting: props.waiting,
        },
      ]}
      onBack={props.onBack}
      title={
        Styles.isMobile
          ? flags.tabletSupport
            ? 'Name this device'
            : 'Name this phone'
          : 'Name this computer'
      }
    >
      <Kb.Box2 direction="vertical" style={styles.contents} centerChildren={true} gap="medium">
        <Kb.Icon type={Kb.isValidIconType(maybeIcon) ? maybeIcon : defaultIcon} />
        <Kb.Box2 direction="vertical" style={styles.wrapper} gap="xsmall">
          <Kb.NewInput
            autoFocus={true}
            error={showDisabled}
            maxLength={64}
            placeholder="Pick a device name"
            onEnterKeyDown={onSubmit}
            onChangeText={_setDeviceName}
            value={cleanDeviceName}
            style={styles.nameInput}
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

const styles = Styles.styleSheetCreate(() => ({
  backButton: Styles.platformStyles({
    isElectron: {
      marginLeft: Styles.globalMargins.medium,
      marginTop: Styles.globalMargins.medium,
    },
    isMobile: {
      marginLeft: 0,
      marginTop: 0,
    },
  }),
  contents: Styles.platformStyles({
    common: {width: '100%'},
    isTablet: {width: undefined},
  }),
  deviceNameError: {
    color: Styles.globalColors.redDark,
  },
  nameInput: Styles.platformStyles({
    common: {
      padding: Styles.globalMargins.tiny,
    },
    isMobile: {
      minHeight: 48,
    },
    isTablet: {
      maxWidth: 368,
    },
  }),
  wrapper: Styles.platformStyles({
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
