import type {MeasureRef} from './measure-ref'
import type {Position} from '@/styles'

type Props = {
  tooltip: string
  attachTo: React.RefObject<MeasureRef>
  position?: Position // on mobile only 'top center' and 'bottom center' are supported,,
}
declare const useTooltip: (p: Props) => React.ReactNode
