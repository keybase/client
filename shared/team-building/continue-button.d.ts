import * as React from 'react'

export type Props = {
  onClick: () => void
  disabled: boolean
}

export default class extends React.PureComponent<Props> {}
