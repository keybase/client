import * as Kb from '@/common-adapters'
import {submitRecoverPasswordPgpWarning} from './flow'
import {useCancelRecoverPasswordOnLeave} from './use-cancel-on-leave'

const PgpWarning = () => {
  useCancelRecoverPasswordOnLeave()
  return (
    <Kb.ModalScreen
      centered={!Kb.Styles.isTablet}
      footer={
        <Kb.Button fullWidth={true} label="Continue" onClick={submitRecoverPasswordPgpWarning} type="Danger" />
      }
    >
      <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
        <Kb.Text type="Body" center={true}>
          Your account has PGP keys stored on Keybase, encrypted with your old password.
        </Kb.Text>
        <Kb.Text type="Body" center={true}>
          If you reset your password you will lose them.
        </Kb.Text>
      </Kb.Box2>
    </Kb.ModalScreen>
  )
}

export default PgpWarning
