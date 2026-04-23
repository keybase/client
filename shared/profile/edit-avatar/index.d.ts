import type * as React from 'react'
import type {ImageInfo} from '@/util/expo-image-picker.native'
import type * as T from '@/constants/types'

export type Props = {
  image?: ImageInfo
  sendChatNotification?: boolean
  showBack?: boolean
  teamID?: string
  createdTeam?: boolean
  wizard?: boolean
  newTeamWizard?: T.Teams.NewTeamWizardState
}

declare const EditAvatar: (p: Props) => React.ReactNode
export default EditAvatar
