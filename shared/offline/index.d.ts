import {Component} from 'react'

import {Reachable} from '../constants/types/rpc-gen'

export type Props = {
  reachable: Reachable
  appFocused: boolean
}

export default class Offline extends Component<Props> {}
