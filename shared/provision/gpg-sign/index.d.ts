import * as React from 'react'

export type Props = {
  importError?: string
  onSubmit: (exportKey: boolean) => void
  onBack: () => void
}

export default class GPGSign extends React.Component<Props> {}
