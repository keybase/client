import {Component} from 'react'
import {PlanLevel} from '../../constants/types/settings'

export type AccountProps = {
  email: string
  isVerified: boolean
  onChangeEmail: () => void
  onChangePassword: () => void
  onChangeRememberPassword: (remember: boolean) => void
  rememberPassword: boolean
  hasRandomPW: boolean | null
}

export type Props = {
  account: AccountProps
}

export default class LandingPage extends Component<Props> {}
