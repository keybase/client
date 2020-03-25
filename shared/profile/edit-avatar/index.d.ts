import {Component} from 'react'
import {ImagePickerResult} from 'expo-image-picker'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Types from '../../constants/types/teams'

export type Props = {
  createdTeam?: boolean
  error: string
  image?: ImagePickerResult
  onBack: () => void
  onClose: () => void
  onSave: (
    filename: string,
    crop?: RPCTypes.ImageCropRect,
    scaledWidth?: number,
    offsetLeft?: number,
    offsetTop?: number
  ) => void
  onSkip: () => void
  sendChatNotification?: boolean
  submitting: boolean
  teamID: Types.TeamID
  teamname?: string
  waitingKey: string
  wizard: boolean
}

export default class Render extends Component<Props> {}
