import * as React from 'react'
import * as Styles from '../../../../styles'

export type Props = {
  items: Array<string>
  keyExtractor?: (item: any) => string
  renderItem: (index: number, item: string) => React.ReactElement | null
  selectedIndex: number
  style?: Styles.StylesCrossPlatform
}

export default class extends React.Component<Props> {}
