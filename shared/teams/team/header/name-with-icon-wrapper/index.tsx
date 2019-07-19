import * as React from 'react'

export type Props = {
  canEditDescription: boolean
  onEditIcon: (image?: string) => void
  onFilePickerError: (error: Error) => void
  teamname: string
  title: string | React.ReactNode
  metaOne: React.ReactNode
  metaTwo: string
}

export default class Render extends React.Component<Props> {}
