import PromptReset from './prompt-reset-shared'
import {useRecoverRunScreen} from './use-prompt-back'

// runId: the recover-password run that showed it, if one did
type Props = {route: {params: {runId?: number; skipPassword: boolean; username: string}}}

const PromptResetAccount = ({route}: Props) => {
  const {runId, skipPassword, username} = route.params
  useRecoverRunScreen({runId})
  return <PromptReset skipPassword={skipPassword} username={username} />
}

export default PromptResetAccount
