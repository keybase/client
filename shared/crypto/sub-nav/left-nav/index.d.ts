import {Component} from 'react'

export type Props = {
  // state: any
  // navigation: any
  // routes: any
  onClick: (string) => void
  selected: string
  children: any
}

export default class SubNav extends Component<Props> {}
