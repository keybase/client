import type * as React from 'react'

export {KeyboardAvoidingView as default} from 'react-native'

export type Props = {
  children: React.ReactNode
  isModal?: boolean
  extraOffset?: number
  // if we're inside something that's using safe, we can compensate
  extraPadding?: number
  // only used on ipad modals since they float
  compensateNotBeingOnBottom?: boolean
}

export declare const KeyboardAvoidingView2: (p: Props) => React.ReactNode
