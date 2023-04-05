import {Component} from 'react'
import {ImageInfo} from '../../util/expo-image-picker.native'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Types from '../../constants/types/teams'

type TeamProps = {
  createdTeam?: boolean
  showBack?: boolean
  teamID: Types.TeamID
  teamname: string
  type: 'team'
  wizard: boolean
  onSkip: () => void
}
type ProfileProps = {
  createdTeam?: false
  onSkip?: undefined
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
    crop?: RPCTypes.ImageCropRect,
    scaledWidth?: number,
    offsetLeft?: number,
    offsetTop?: number
  ) => void
  sendChatNotification?: boolean
  submitting: boolean
  waitingKey: string
} & (TeamProps | ProfileProps)

export default class Render extends Component<Props> {}
