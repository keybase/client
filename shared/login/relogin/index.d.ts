import type * as React from 'react'
import type * as T from '@/constants/types'

export type Props = {
  users: Array<T.Config.ConfiguredAccount>
  onForgotPassword: () => void
  onSignup: () => void
  onSomeoneElse: () => void
  error: string
  needPassword: boolean
  password: string
  showTyping: boolean
  selectedUser: string
  selectedUserChange: (selectedUser: string) => void
  passwordChange: (password: string) => void
  showTypingChange: (typingChange: boolean) => void
  onSubmit: () => void
  onFeedback: () => void
  onLogin: (user: string, password: string) => void
}
declare const Login: (p: Props) => React.ReactNode
export default Login
