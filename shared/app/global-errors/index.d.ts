import * as React from 'react'
import {RPCError} from '../../util/errors'

export type Props = {
  onFeedback: () => void
  error?: Error | RPCError
  daemonError?: Error
  onDismiss: () => void
  copyToClipboard: (arg0: string) => void
}

export default class GlobalError extends React.Component<Props> {}
