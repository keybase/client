import {Component} from 'react'

export type Props = {
  onChangeCardNumber: (cardNumber: string) => void
  onChangeName: (name: string) => void
  onChangeExpiration: (expiration: string) => void
  onChangeSecurityCode: (securityCode: string) => void
  cardNumber: string | null
  name: string | null
  expiration: string | null
  securityCode: string | null
  errorMessage?: string | null
  onBack: () => void
  onSubmit: () => void
}

export default class FilesSettings extends Component<Props> {}
