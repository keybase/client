import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Platform from '../../constants/platform'
import {SignupScreen, errorBanner} from '../common'
import PhoneInput from './phone-input'
import {ButtonType} from '../../common-adapters/button'

export type Props = {
  error: string
  onContinue: (phoneNumber: string, searchable: boolean) => void
  onSkip: () => void
  waiting: boolean
}

const EnterPhoneNumber = (props: Props) => {
  const [phoneNumber, onChangePhoneNumber] = React.useState('')
  const [valid, onChangeValidity] = React.useState(false)
  // const [searchable, onChangeSearchable] = React.useState(true)
  const disabled = !valid
  const onContinue = () =>
    disabled || props.waiting ? {} : props.onContinue(phoneNumber, true /* searchable */)
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
          type: 'Success' as ButtonType,
          waiting: props.waiting,
        },
      ]}
      banners={errorBanner(props.error)}
      rightActionLabel="Skip"
      onRightAction={props.onSkip}
      title="Your phone number"
      showHeaderInfoicon={true}
    >
      <EnterPhoneNumberBody
        // the push prompt might be overlaying us
        // TODO Y2K-57 move phone number earlier and check that email won't have this problem
        autoFocus={!Styles.isMobile}
        onChangeNumber={onChangeNumberCb}
        onContinue={onContinue}
        searchable={true}
        iconType={Platform.isLargeScreen ? 'icon-phone-number-add-96' : 'icon-phone-number-add-64'}
      />
    </SignupScreen>
  )
}

type BodyProps = {
  autoFocus: boolean
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
      gap={Styles.isMobile ? 'small' : 'medium'}
      fullWidth={true}
      style={Styles.globalStyles.flexOne}
    >
      <Kb.Icon type={props.iconType} />
      <Kb.Box2 direction="vertical" gap="tiny" style={styles.inputBox}>
        <PhoneInput
          autoFocus={props.autoFocus}
          style={styles.input}
          onChangeNumber={props.onChangeNumber}
          onEnterKeyDown={props.onContinue}
        />
        {showCheckbox ? (
          <Kb.Checkbox
            label="Allow friends to find you by this phone number"
            checked={props.searchable}
            onCheck={props.onChangeSearchable || null}
            style={styles.checkbox}
          />
        ) : (
          <Kb.Text type="BodySmall">Allow your friends to find you.</Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}
EnterPhoneNumberBody.defaultProps = {
  autoFocus: true,
}

const styles = Styles.styleSheetCreate(() => ({
  checkbox: {width: '100%'},
  input: Styles.platformStyles({
    isElectron: {
      height: 38,
      width: 368,
    },
    isMobile: {
      height: 48,
      width: '100%',
    },
  }),
  inputBox: Styles.platformStyles({
    isElectron: {
      // need to set width so subtext will wrap
      width: 368,
    },
  }),
}))

export default EnterPhoneNumber
