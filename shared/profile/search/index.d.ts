import {Component} from 'react'

export type Props = {
  onClick: (username: string) => void
  onClose: () => void
}

export default class Search extends Component<Props> {}
