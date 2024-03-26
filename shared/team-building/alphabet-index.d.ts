import type * as Kb from '@/common-adapters'
export type Props = {
  labels: Array<string>
  showNumSection: boolean
  measureKey?: unknown // change this when the position of AlphabetIndex on the screen changes
  onScroll: (label: string) => void
  style?: Kb.Styles.StylesCrossPlatform
}

export declare const AlphabetIndex: (p: Props) => React.ReactNode
export default AlphabetIndex
