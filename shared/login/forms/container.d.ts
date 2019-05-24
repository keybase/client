import * as React from 'react'

export type Props = {
  onBack?: () => void
  children?: React.ElementType
  style?: Object | null
  outerStyle?: Object | null
}

export declare class Container extends React.Component<Props> {}
