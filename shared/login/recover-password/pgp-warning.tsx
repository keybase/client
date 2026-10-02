import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {useOnRemove} from '@/util/safe-navigation'
import {SignupScreen} from '@/signup/common'
import {QuestionBody} from '../common'
import {answerRecoverPasswordPgp} from './flow'

type Props = {route: {params: {pgpPromptID: number}}}

const PgpWarning = ({route}: Props) => {
  const {pgpPromptID} = route.params
  const onContinue = () => answerRecoverPasswordPgp(pgpPromptID, true)
  const onCancel = () => answerRecoverPasswordPgp(pgpPromptID, false)
  // Any removal (Android back, a native dismissal, a reset elsewhere) is a decline, or Go waits forever. The
  // flow settles its own prompts before it navigates, so its removals find this already answered. The screen
  // is already going, so nothing navigates.
  useOnRemove(() => answerRecoverPasswordPgp(pgpPromptID, false, 'screenRemoving'))

  return (
    <SignupScreen
      buttons={[
        {
          label: 'Continue',
          onClick: onContinue,
          type: 'Danger',
          waitingKey: C.waitingKeyRecoverPassword,
        },
        {label: 'Cancel', onClick: onCancel, type: 'Dim'},
      ]}
      // The modal's route header carries the title and the declining back button.
      hideDesktopHeader={true}
      noBackground={true}
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
