import * as React from 'react'
import * as ImagePicker from 'expo-image-picker'

export type Props = {
  canEditDescription: boolean
  onEditIcon: (image?: ImagePicker.ImagePickerResult) => void
  onFilePickerError: (error: Error) => void
  teamname: string
  title: string | React.ReactNode
  metaOne: React.ReactNode
  metaTwo: string
}

export default class Render extends React.Component<Props> {}
