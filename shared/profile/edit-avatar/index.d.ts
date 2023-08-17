import * as React from 'react'
import {ImageInfo} from '../../util/expo-image-picker.native'
import * as T from '../../constants/types'

type TeamProps = {
  createdTeam?: boolean
  showBack?: boolean
  teamID: T.Teams.TeamID
  teamname: string
  type: 'team'
  wizard: boolean
  onSkip: () => void
}
type ProfileProps = {
  createdTeam?: false
  onSkip?: undefined
  teamname?: string
  teamID?: T.Teams.TeamID
  type: 'profile'
  showBack?: false
  wizard?: false
}

export type Props = {
  error: string
  image?: ImageInfo
  onBack: () => void
  onClose: () => void
  onSave: (
    filename: string,
    crop?: T.RPCGen.ImageCropRect,
    scaledWidth?: number,
    offsetLeft?: number,
    offsetTop?: number
  ) => void
  sendChatNotification?: boolean
  submitting: boolean
  waitingKey: string
} & (TeamProps | ProfileProps)

export default class Render extends React.Component<Props> {}
