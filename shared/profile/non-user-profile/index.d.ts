import {Component} from 'react'
import {ServiceId} from '../../constants/types/team-building'

export type Props = {
  avatar: string | null
  fullname: string
  onBack: () => void
  onOpenPrivateFolder: () => void
  onStartChat: () => void
  profileUrl: string
  serviceId: ServiceId
  title: string
  username: string
}

export default class Render extends Component<Props> {}
