import PromptReset from './prompt-reset-shared'

type Props = {route: {params: {username: string}}}

const PromptResetPassword = ({route}: Props) => (
  <PromptReset recoverUsername={route.params.username} resetPassword={true} />
)

export default PromptResetPassword
