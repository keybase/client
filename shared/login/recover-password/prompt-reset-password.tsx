import PromptReset from './prompt-reset-shared'
import {startRecoverPassword} from './flow'
import {useRecoverPromptBack} from './use-prompt-back'

type Props = {route: {params: {promptId: number; username: string}}}

const PromptResetPassword = ({route}: Props) => {
  const {promptId, username} = route.params
  useRecoverPromptBack(promptId, () => startRecoverPassword({replaceRoute: true, username}))
  return <PromptReset resetPassword={true} resetPromptId={promptId} skipPassword={true} username={username} />
}

export default PromptResetPassword
