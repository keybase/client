import * as React from 'react'

export type Props = {
  rows: Array<any>
  renderRow: (row: any) => React.ReactElement | null
}

export default class List extends React.Component<Props> {}
