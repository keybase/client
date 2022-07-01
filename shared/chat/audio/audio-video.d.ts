import * as React from 'react'

export type Props = {
  url: string
  paused: boolean
  seekRef: React.MutableRefObject<null | ((s: number) => void)>
}

export default class extends React.Component<Props> {}
