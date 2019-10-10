import {Component} from 'react'
import {ConfiguredAccount} from '../../constants/types/config'

export type Props = {
  users: Array<ConfiguredAccount>
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

export default class Login extends Component<Props> {}
