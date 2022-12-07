import * as React from 'react'
import type {Position} from '../styles'
import type {Box2} from '../common-adapters/box'

export type Props = {
  attachTo: () => Box2 | null
  onHidden: () => void
  position: Position
  positionFallbacks?: Position[]
}

export default class extends React.PureComponent<Props> {}
