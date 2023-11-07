import type * as React from 'react'
import type {IconType} from './icon'

export type Option = {
  title: string
  description: string
  icon: IconType
  onClick: () => void
  onPress?: never
}

export type Props = {
  options: Array<Option>
}

declare const ChoiceList: (p: Props) => React.ReactNode
export default ChoiceList
