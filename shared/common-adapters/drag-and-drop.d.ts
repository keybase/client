import * as React from 'react'
import * as Styles from '../styles'

export type Props = {
  allowFolders?: boolean
  children: React.ReactNode
  containerStyle?: Styles.StylesCrossPlatform
  fullHeight?: boolean
  fullWidth?: boolean
  onAttach: ((array: Array<string>) => void) | null
  rejectReason?: string
}

export default class DragAndDrop extends React.Component<Props> {}
