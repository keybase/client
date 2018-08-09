// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'

type HeaderProps = {|
  amountNominal: string,
  bottomLine: string,
  icon: Kb.IconType,
  topLine: string,
|}

type Props = {|
  ...HeaderProps,
  attachTo?: ?React.Component<any, any>,
  balanceChange: string,
  balanceChangeColor: string,
  onHidden: () => void,
  position: Position,
  txType: 'sent' | 'received',
|}
