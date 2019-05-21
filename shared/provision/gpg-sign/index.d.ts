import React, {Component} from 'react'

export type Props = {
  importError: string | null,
  onSubmit: (exportKey: boolean) => void,
  onBack: () => void
};

export default class GPGSign extends Component<Props> {}
