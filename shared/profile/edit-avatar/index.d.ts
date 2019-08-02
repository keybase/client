import {Component} from 'react'
import {ImagePickerResult} from 'expo-image-picker'
import * as RPCTypes from '../../constants/types/rpc-gen'

export type Props = {
  createdTeam?: boolean
  error: string
  image?: ImagePickerResult
  onClose: () => void
  onSave: (filename: string, crop?: RPCTypes.ImageCropRect) => void
  sendChatNotification?: boolean
  submitting: boolean
  teamname?: string
  waitingKey: string
}

export default class Render extends Component<Props> {}
