import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen, errorBanner} from './common'
import {useAddEmail} from '@/settings/account/use-add-email'
import {usePushState} from '@/stores/push'
import {setSignupEmail} from '@/people/signup-email'

const ConnectedEnterEmail = () => {
  const _showPushPrompt = usePushState(s => isMobile && !s.hasPermissions && s.showPushPrompt)
  const {error, submitEmail, waiting} = useAddEmail()
  const clearModals = C.Router2.clearModals
  const navigateAppend = C.Router2.navigateAppend
  const afterEmail = () => {
    if (_showPushPrompt) {
      navigateAppend({name: 'settingsPushPrompt', params: {}}, true)
    } else {
      clearModals()
    }
  }

  const onCreate = (email: string, searchable: boolean) => {
    submitEmail(email, searchable, addedEmail => {
      setSignupEmail(addedEmail)
      afterEmail()
    })
  }

  const [email, onChangeEmail] = React.useState('')
  const [searchable, onChangeSearchable] = React.useState(true)
  const disabled = !email.trim()
  const onContinue = () => {
    if (disabled || waiting) {
      return
    }
    onCreate(email.trim(), searchable)
  }

  return (
    <SignupScreen
      banners={errorBanner(error)}
      buttons={[
        {
          disabled,
          label: 'Finish',
          onClick: onContinue,
          type: 'Success',
          waiting,
        },
      ]}
    >
      <EnterEmailBody
        onChangeEmail={onChangeEmail}
        onContinue={onContinue}
        email={email}
        showSearchable={true}
        searchable={searchable}
        onChangeSearchable={onChangeSearchable}
        iconType={C.isLargeScreen ? 'icon-email-add-96' : 'icon-email-add-64'}
      />
    </SignupScreen>
  )
}

type BodyProps = {
  onChangeEmail: (email: string) => void
  onContinue: () => void
  email: string
  searchable: boolean
  onChangeSearchable: (allow: boolean) => void
  showSearchable: boolean
  iconType: Kb.IconType
}
export const EnterEmailBody = (props: BodyProps) => {
  const styles = useStyles()
  return (
    <Kb.Box2 alignItems="center" direction="vertical" gap={isMobile ? 'small' : 'medium'} fullWidth={true} flex={1}>
      <Kb.ImageIcon type={props.iconType} />
      <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
        <Kb.Input3
          textType="BodySemibold"
          autoFocus={true}
          keyboardType="email-address"
          placeholder="Email address"
          onChangeText={props.onChangeEmail}
          onEnterKeyDown={props.onContinue}
          textContentType="emailAddress"
          value={props.email}
        />
        {props.showSearchable && (
          <Kb.Checkbox
            label="Allow friends to find you by this email address"
            checked={props.searchable}
            onCheck={props.onChangeSearchable}
            style={styles.checkbox}
          />
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  checkbox: {width: '100%'},
}))

export default ConnectedEnterEmail
