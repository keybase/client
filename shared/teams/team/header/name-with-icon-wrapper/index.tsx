import * as React from 'react'

type Response = any

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
