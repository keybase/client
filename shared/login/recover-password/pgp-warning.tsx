import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {ButtonType} from '@/common-adapters/button'
import {useNavigation} from '@react-navigation/native'
import {SignupScreen} from '@/signup/common'
import {QuestionBody} from '../common'
import {cancelRecoverPassword, submitRecoverPasswordPgpContinue} from './flow'

const PgpWarning = () => {
  const navigation = useNavigation()
  const answeredRef = React.useRef(false)
  const onContinue = () => {
    answeredRef.current = true
    submitRecoverPasswordPgpContinue()
  }
  const onCancel = () => {
    answeredRef.current = true
    cancelRecoverPassword()
  }

  // Android back and any other removal must still answer Go. After Continue the next prompt replaces this
  // screen, and firing cancel then would hit that prompt's own cancel slot.
  React.useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      if (answeredRef.current) return
      answeredRef.current = true
      cancelRecoverPassword()
    })
  }, [navigation])

  return (
    <SignupScreen
      buttons={[
        {
          label: 'Continue',
          onClick: onContinue,
          type: 'Danger' as ButtonType,
          waitingKey: C.waitingKeyRecoverPassword,
        },
        {label: 'Cancel', onClick: onCancel, type: 'Dim' as ButtonType},
      ]}
      noBackground={true}
      onBack={onCancel}
      title="Recover password"
    >
      <QuestionBody centered={true} gap="small" topGap={false} icon={<Kb.ImageIcon type="icon-pgp-key-64" />}>
        <Kb.Text type="Body" center={true}>
          Your account has PGP keys stored on Keybase, encrypted with your old password.
        </Kb.Text>
        <Kb.Text type="Body" center={true}>
          If you reset your password you will lose them.
        </Kb.Text>
      </QuestionBody>
    </SignupScreen>
  )
}

export default PgpWarning
