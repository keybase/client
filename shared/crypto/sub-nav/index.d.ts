import {Component} from 'react'
import * as Types from '../../constants/types/crypto'

export type Props = {
  children?: React.ReactNode
  routeSelected: Types.CryptoSubTab
}

export default class SubNav extends Component<Props> {}
