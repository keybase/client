import * as React from 'react'

export type Props = {
  allowFolders?: boolean
  children: React.ReactNode
  onAttach: ((array: Array<string>) => void )| null
}

export default class DragAndDrop extends React.Component<Props> {}
