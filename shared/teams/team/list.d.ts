import * as React from 'react'

export type Props = {
  rows: Array<any>
  renderRow: (row: any) => React.ReactNode
}

export default class List extends React.Component<Props> {}
