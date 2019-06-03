import * as React from 'react'
// @ts-ignore not typed yet
import {Response} from 'react-native-image-picker'

export type Props = {
  canEditDescription: boolean
  onEditIcon: (image?: Response) => void
  onFilePickerError: (error: Error) => void
  teamname: string
  title: string | React.ReactNode
  metaOne: React.ReactNode
  metaTwo: string
}

export default class Render extends React.Component<Props> {}
