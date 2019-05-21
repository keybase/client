import {Component} from 'react'

export type Props = {
  prompt: string,
  onSubmit: () => void,
  onChange: (password: string) => void,
  password: string | null,
  onBack: () => void,
  onForgotPassword: () => void,
  waitingForResponse: boolean,
  error?: string | null,
  username: string | null,
  showTyping: boolean,
  toggleShowTyping: () => void
};

export default class Password extends Component<Props> {}
