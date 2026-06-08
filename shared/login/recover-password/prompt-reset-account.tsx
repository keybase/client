import PromptReset from './prompt-reset-shared'

type Props = {route: {params: {skipPassword: boolean; username: string}}}

const PromptResetAccount = ({route}: Props) => (
  <PromptReset skipPassword={route.params.skipPassword} username={route.params.username} />
)

export default PromptResetAccount
