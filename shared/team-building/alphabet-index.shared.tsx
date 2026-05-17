import type * as Kb from '@/common-adapters'

export type Props = {
  labels: Array<string>
  showNumSection: boolean
  measureKey?: unknown
  onScroll: (label: string) => void
  style?: Kb.Styles.StylesCrossPlatform
}
