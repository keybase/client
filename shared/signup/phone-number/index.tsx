import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen, errorBanner} from '../common'
import {useAddPhoneNumber} from './use-verification'
import {useDefaultPhoneCountry} from '@/util/phone-numbers'

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
      <Kb.ImageIcon type={props.iconType} />
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
  const defaultCountry = useDefaultPhoneCountry()
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const {clearError, error, submitPhoneNumber, waiting} = useAddPhoneNumber()
  const onSkip = () => {
    navigateAppend('signupEnterEmail', true)
  }

  const [phoneNumber, onChangePhoneNumber] = React.useState('')
  const [valid, onChangeValidity] = React.useState(false)
  const disabled = !valid
  const onContinue = () => {
    if (disabled || waiting) {
      return
    }
    submitPhoneNumber(phoneNumber, true, submittedPhoneNumber => {
      navigateAppend({name: 'signupVerifyPhoneNumber', params: {phoneNumber: submittedPhoneNumber}})
    })
  }
  const onChangeNumberCb = (phoneNumber: string, validity: boolean) => {
    if (error) {
      clearError()
    }
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
