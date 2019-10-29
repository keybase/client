import * as React from 'react'

export type Props = {
  url: string
  paused: boolean
}

export default class extends React.Component<Props> {
  seek: (seconds: number) => void
}
