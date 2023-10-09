import * as React from 'react'
import type {Position} from '../../styles'
import type {MeasureRef} from '../../common-adapters/measure-ref'

export type Props = {
  attachTo?: React.RefObject<MeasureRef>
  onHidden: () => void
  position: Position
  positionFallbacks?: ReadonlyArray<Position>
}

export default class extends React.PureComponent<Props> {}
