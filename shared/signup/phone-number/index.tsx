import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen, errorBanner} from '../common'
import {useSettingsPhoneState} from '@/stores/settings-phone'

type BodyProps = {
  autoFocus?: boolean
  defaultCountry?: string
  onChangeNumber: (phoneNumber: string, valid: boolean) => void
  onContinue: () => void
  searchable: boolean
  onChangeSearchable?: (allow: boolean) => void
  iconType: Kb.IconType
}

export const EnterPhoneNumberBody = (props: BodyProps) => {
  const showCheckbox = !!props.onChangeSearchable
  return (
    <Kb.Box2
      alignItems="center"
      direction="vertical"
      gap={Kb.Styles.isMobile ? 'small' : 'medium'}
      fullWidth={true}
      style={styles.container}
    >
      <Kb.Icon type={props.iconType} />
      <Kb.Box2 direction="vertical" gap="tiny" style={styles.inputBox}>
        <Kb.PhoneInput
          autoFocus={props.autoFocus ?? true}
          defaultCountry={props.defaultCountry}
          style={styles.input}
          onChangeNumber={props.onChangeNumber}
          onEnterKeyDown={props.onContinue}
        />
        {showCheckbox ? (
          <Kb.Checkbox
            label="Allow friends to find you by this phone number"
            checked={props.searchable}
            onCheck={props.onChangeSearchable}
            style={styles.checkbox}
          />
        ) : (
          <Kb.Text type="BodySmall">Allow your friends to find you.</Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  checkbox: {width: '100%'},
  container: Kb.Styles.platformStyles({
    common: Kb.Styles.globalStyles.flexOne,
    isTablet: {maxWidth: 386},
  }),
  input: Kb.Styles.platformStyles({
    isElectron: {
      height: 38,
      width: 368,
    },
    isMobile: {
      height: 48,
      width: '100%',
    },
  }),
  inputBox: Kb.Styles.platformStyles({
    // need to set width so subtext will wrap
    isElectron: {width: 368},
  }),
}))

const ConnectedEnterPhoneNumber = () => {
  const defaultCountry = useSettingsPhoneState(s => s.defaultCountry)
  const error = useSettingsPhoneState(s => s.error)
  const pendingVerification = useSettingsPhoneState(s => s.pendingVerification)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeySettingsPhoneAddPhoneNumber)
  const clearPhoneNumberErrors = useSettingsPhoneState(s => s.dispatch.clearPhoneNumberErrors)
  const clearPhoneNumberAdd = useSettingsPhoneState(s => s.dispatch.clearPhoneNumberAdd)
  const onClear = clearPhoneNumberErrors
  const addPhoneNumber = useSettingsPhoneState(s => s.dispatch.addPhoneNumber)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onGoToVerify = React.useCallback(() => {
    navigateAppend('signupVerifyPhoneNumber')
  }, [navigateAppend])
  const onSkip = React.useCallback(() => {
    clearPhoneNumberAdd()
    navigateAppend('signupEnterEmail', true)
  }, [clearPhoneNumberAdd, navigateAppend])

  React.useEffect(() => {
    return () => {
      onClear()
    }
  }, [onClear])

  const lastPendingVerificationRef = React.useRef(pendingVerification)
  React.useEffect(() => {
    if (!error && pendingVerification && lastPendingVerificationRef.current !== pendingVerification) {
      onGoToVerify()
    }
    lastPendingVerificationRef.current = pendingVerification
  }, [pendingVerification, error, onGoToVerify])

  // trigger a default phone number country rpc if it's not already loaded
  const loadDefaultPhoneCountry = useSettingsPhoneState(s => s.dispatch.loadDefaultPhoneCountry)
  React.useEffect(() => {
    !defaultCountry && loadDefaultPhoneCountry()
  }, [defaultCountry, loadDefaultPhoneCountry])

  const [phoneNumber, onChangePhoneNumber] = React.useState('')
  const [valid, onChangeValidity] = React.useState(false)
  const disabled = !valid
  const onContinue = () => (disabled || waiting ? {} : addPhoneNumber(phoneNumber, true /* searchable */))
  const onChangeNumberCb = (phoneNumber: string, validity: boolean) => {
    onChangePhoneNumber(phoneNumber)
    onChangeValidity(validity)
  }
  return (
    <SignupScreen
      buttons={[
        {
          disabled,
          label: 'Continue',
          onClick: onContinue,
          type: 'Success' as const,
          waiting: waiting,
        },
      ]}
      banners={errorBanner(error)}
      rightActionLabel="Skip"
      onRightAction={onSkip}
      title="Your phone number"
      showHeaderInfoicon={true}
    >
      <EnterPhoneNumberBody
        autoFocus={!Kb.Styles.isMobile}
        defaultCountry={defaultCountry}
        onChangeNumber={onChangeNumberCb}
        onContinue={onContinue}
        searchable={true}
        iconType={C.isLargeScreen ? 'icon-phone-number-add-96' : 'icon-phone-number-add-64'}
      />
    </SignupScreen>
  )
}

export default ConnectedEnterPhoneNumber
