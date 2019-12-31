import * as React from 'react'
import * as TeamsTypes from '../../constants/types/teams'

export type Props = {
  channelname: string
  description: string
  errorText: string
  onBack?: () => void
  onClose?: () => void
  onSubmit: () => void
  onDescriptionChange: (description: string) => void
  onChannelnameChange: (channelname: string) => void
  teamID: TeamsTypes.TeamID
  teamname: string
}
export declare class CreateChannel extends React.Component<Props> {}
export default CreateChannel
