import {Component} from 'react'

export type Props = {
  users: Array<string>
  onForgotPassword: () => void
  onSignup: () => void
  onSomeoneElse: () => void
  inputError: boolean
  bannerError: boolean
  error: string
  inputKey: string
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
