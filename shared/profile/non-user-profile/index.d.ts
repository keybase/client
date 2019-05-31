import {Component} from 'react'
import {Service} from '../../constants/types/search'

export type Props = {
  avatar: string | null
  fullname: string
  onBack: () => void
  onOpenPrivateFolder: () => void
  onStartChat: () => void
  profileUrl: string
  serviceName: Service
  username: string
}

export default class Render extends Component<Props> {}
