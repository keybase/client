import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type {ButtonType} from '@/common-adapters/button'
import {SignupScreen} from '@/signup/common'
import {QuestionBody} from '../common'
import {cancelRecoverPassword, submitRecoverPasswordPgpContinue} from './flow'

const PgpWarning = () => (
  <SignupScreen
    buttons={[
      {
        label: 'Continue',
        onClick: submitRecoverPasswordPgpContinue,
        type: 'Danger' as ButtonType,
        waitingKey: C.waitingKeyRecoverPassword,
      },
      {label: 'Cancel', onClick: cancelRecoverPassword, type: 'Dim' as ButtonType},
    ]}
    noBackground={true}
    onBack={cancelRecoverPassword}
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

export default PgpWarning
