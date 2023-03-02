import * as React from 'react'

export {KeyboardAvoidingView as default} from 'react-native'

export type Props = {
  children: React.ReactNode
  isModal?: boolean
  extraOffset?: number
  // force patched RA KAV to just use the keyboard frame
  rawHeight?: boolean
}

export declare class KeyboardAvoidingView2 extends React.Component<Props> {}
