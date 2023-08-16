import * as React from 'react'
import * as T from '../../constants/types'

export type Props = {
  channelname: string
  description: string
  errorText: string
  onBack?: () => void
  onClose?: () => void
  onSubmit: () => void
  onDescriptionChange: (description: string) => void
  onChannelnameChange: (channelname: string) => void
  teamID: T.Teams.TeamID
  teamname: string
}
export declare class CreateChannel extends React.Component<Props> {}
export default CreateChannel
