import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type {ButtonType} from '@/common-adapters/button'
import {SignupScreen} from '@/signup/common'
import {useConfigState} from '@/stores/config'

type Props = {route: {params: {error: string}}}

const ConnectedError = ({route}: Props) => {
  const loggedIn = useConfigState(s => s.loggedIn)
  const {error} = route.params
  const popStack = C.useRouterState(s => s.dispatch.popStack)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    loggedIn ? navigateUp() : popStack()
  }
  return (
    <SignupScreen
      buttons={[
        {
          label: 'Back',
          onClick: onBack,
          type: 'Default' as ButtonType,
        },
      ]}
      onBack={onBack}
      title="Recover password"
    >
      <Kb.Text center={true} type="Header" style={{maxWidth: 460, width: '80%'}}>
        Password recovery failed
      </Kb.Text>
      <Kb.Text type="Body" center={true}>
        {error}
      </Kb.Text>
    </SignupScreen>
  )
}

export default ConnectedError
