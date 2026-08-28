import * as C from '@/constants'
import {useSafeSubmit} from '@/util/safe-submit'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import debounce from 'lodash/debounce'
import {SignupScreen, errorBanner} from '../signup/common'
import * as Provision from '@/constants/provision'
import * as T from '@/constants/types'
import {submitProvisionDeviceName} from './flow'
// shared with the signup flow so the two device-name screens cannot drift
import {isDeviceNameDisabled, makeCleanDeviceName} from '../signup/device-name'

type Props = {
  route: {
    params: {
      devices?: ReadonlyArray<Provision.Device>
      error?: string
    }
  }
}

const SetPublicName = ({route}: Props) => {
  const styles = useStyles()
  const devices = route.params.devices ?? []
  const error = route.params.error ?? ''
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvision)
  const onBack = useSafeSubmit(C.Router2.navigateUp, !!error)
  const iconNumbers = T.Devices.nextDeviceIconNumbers(devices)
  const deviceIconNumber = isMobile ? iconNumbers.mobile : iconNumbers.desktop

  const [deviceName, setDeviceName] = React.useState(C.defaultDevicename)
  const [readyToShowError, setReadyToShowError] = React.useState(false)
  const debouncedSetReadyToShowError = debounce((ready: boolean) => setReadyToShowError(ready), 1000)
  const cleanDeviceName = makeCleanDeviceName(deviceName)
  const disabled = isDeviceNameDisabled(cleanDeviceName)
  const showDisabled = disabled && !!cleanDeviceName && readyToShowError
  const onSubmit = () => {
    if (!waiting) submitProvisionDeviceName(cleanDeviceName)
  }
  const onChangeDeviceName = (name: string) => {
    setReadyToShowError(false)
    setDeviceName(makeCleanDeviceName(name))
    debouncedSetReadyToShowError(true)
  }

  const maybeIcon = isMobile
    ? C.isLargeScreen
      ? `icon-phone-background-${deviceIconNumber}-96`
      : `icon-phone-background-${deviceIconNumber}-64`
    : `icon-computer-background-${deviceIconNumber}-96`

  const defaultIcon = isMobile
    ? C.isLargeScreen
      ? `icon-phone-96`
      : `icon-phone-64`
    : `icon-computer-96`

  return (
    <SignupScreen
      hideDesktopHeader={!isMobile}
      waitingOverlay={true}
      banners={errorBanner(error)}
      buttons={[
        {
          disabled,
          label: 'Continue',
          onClick: onSubmit,
          type: 'Success',
          waiting,
        },
      ]}
      onBack={onBack}
      title={isMobile ? 'Name this device' : 'Name this computer'}
    >
      <Kb.Box2 direction="vertical" style={styles.contents} centerChildren={true} gap="medium">
        <Kb.ImageIcon type={Kb.isValidIconType(maybeIcon) ? maybeIcon : defaultIcon} />
        <Kb.Box2 direction="vertical" style={styles.wrapper} gap="xsmall">
          <Kb.Input3
            textType="BodySemibold"
            autoFocus={true}
            error={showDisabled}
            maxLength={64}
            placeholder="Pick a device name"
            onEnterKeyDown={onSubmit}
            onChangeText={onChangeDeviceName}
            value={cleanDeviceName}
            containerStyle={styles.nameInput}
          />
          {showDisabled ? (
            <Kb.Text type="BodySmall" style={styles.deviceNameError}>
              {Provision.deviceNameInstructions}
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

const useStyles = Kb.Styles.createStyleHook(theme => ({
  contents: Kb.Styles.platformStyles({
    common: {width: '100%'},
    isTablet: {width: undefined},
  }),
  deviceNameError: {color: theme.redDark},
  nameInput: Kb.Styles.platformStyles({
    common: {padding: Kb.Styles.globalMargins.tiny},
    isMobile: {minHeight: 48},
    isTablet: {maxWidth: 368},
  }),
  wrapper: Kb.Styles.platformStyles({
    isElectron: {width: 400},
    isMobile: {width: '100%'},
  }),
}))

export default SetPublicName
