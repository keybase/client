import * as React from 'react'
import * as Styles from '../../../../styles'

export type Props = {
  items: Array<string>
  keyExtractor: (item: any) => string | number | null
  renderItem: (index: number, item: string) => React.ReactNode
  selectedIndex: number
  style?: Styles.StylesCrossPlatform
}

export default class extends React.Component<Props> {}
