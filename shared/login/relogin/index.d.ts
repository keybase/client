import {Component} from 'react'
import {ConfiguredAccount} from '../../constants/types/config'

export type Props = {
  error: string
  needPassword: boolean
  onFeedback: () => void
  onForgotPassword: () => void
  onLogin: (user: string, password: string) => void
  onShowProxySettings: () => void
  onSignup: () => void
  onSomeoneElse: () => void
  onSubmit: () => void
  password: string
  passwordChange: (password: string) => void
  selectedUser: string
  selectedUserChange: (selectedUser: string) => void
  showTyping: boolean
  showTypingChange: (typingChange: boolean) => void
  users: Array<ConfiguredAccount>
}

export default class Login extends Component<Props> {}
