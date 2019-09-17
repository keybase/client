import * as React from 'react'

type Props = {
  dismiss: () => void
  done: boolean
  isFirst: boolean
  children: React.ReactNode
}

export default class extends React.PureComponent<Props> {}
