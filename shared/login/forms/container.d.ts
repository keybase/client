import * as React from 'react'

export type Props = {
  onBack?: () => void
  children?: React.ReactNode
  style?: Object | null
  outerStyle?: Object | null
}

declare class Container extends React.Component<Props> {}
export default Container
