import PromptReset from './prompt-reset-shared'

type Props = {route: {params: {username: string}}}

const PromptResetPassword = ({route}: Props) => (
  <PromptReset resetPassword={true} skipPassword={true} username={route.params.username} />
)

export default PromptResetPassword
