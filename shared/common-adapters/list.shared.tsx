import type {LegendListRef as _LegendListRef} from '@legendapp/list/react'

export type FixedHeight = {
  height: number
  type: 'fixed'
}

export type FixedListItemAuto = {
  sizeType: 'Small' | 'Large'
  type: 'fixedListItemAuto'
}

export type LegendListRef = _LegendListRef & {
  getState: () => LegendListState
}

export type LegendListState = {
  end: number
  scroll: number
  scrollLength: number
  start: number
}

export type TrueVariable = {
  type: 'trueVariable'
}
