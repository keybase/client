import * as Kb from '@/common-adapters'
import * as React from 'react'
import {NavigationContext} from '@react-navigation/core'
import {getVisibleScreen, navigateUp} from '@/constants/router'
import {answerRecoverPasswordPgp, isRecoverPasswordPgpPending, markRecoverPasswordPgpShown} from './flow'

type Props = {route: {params: {id: number}}}

const PgpWarning = ({route}: Props) => {
  const {id} = route.params
  // Absent outside a navigator (storybook).
  const navigation = React.useContext(NavigationContext)

  React.useEffect(() => {
    markRecoverPasswordPgpShown(id)
  }, [id])

  // A deferred push can land after its prompt was settled; there is nothing left to answer.
  React.useEffect(() => {
    if (isRecoverPasswordPgpPending(id)) return
    const visible = getVisibleScreen(true)
    if (visible?.name === 'recoverPasswordPgpWarning' && (visible.params as {id?: number}).id === id) {
      navigateUp()
    }
  }, [id])

  React.useEffect(() => {
    if (!navigation) return
    return navigation.addListener('beforeRemove', e => {
      // Only the user taking the warning away is a decline: the header Cancel, Android back or a native
      // dismissal (REMOVE). Resets elsewhere also remove screens and are not answers.
      const {type} = e.data.action
      if (type === 'POP' || type === 'GO_BACK' || type === 'REMOVE') {
        answerRecoverPasswordPgp(id, false)
      }
    })
  }, [navigation, id])

  const onContinue = () => {
    answerRecoverPasswordPgp(id, true)
    navigateUp()
  }

  return (
    <Kb.ModalScreen
      centered={!Kb.Styles.isTablet}
      footer={<Kb.Button fullWidth={true} label="Continue" onClick={onContinue} type="Danger" />}
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
