import type * as React from 'react'
import type * as T from '@/constants/types'

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
declare const CreateChannel: (p: Props) => React.ReactNode
export default CreateChannel
