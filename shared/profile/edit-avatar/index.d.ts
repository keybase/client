import type * as React from 'react'
import type {ImageInfo} from '@/util/expo-image-picker.native'

export type Props = {
  image?: ImageInfo
  sendChatNotification?: boolean
  showBack?: boolean
  teamID?: string
  createdTeam?: boolean
  wizard?: boolean
}

declare const EditAvatar: (p: Props) => React.ReactNode
export default EditAvatar
