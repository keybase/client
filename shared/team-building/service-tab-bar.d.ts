import * as React from 'react'
import type {ServiceIdWithContact} from '../constants/types/team-building'

export type Props = {
  services: Array<ServiceIdWithContact>
  selectedService: ServiceIdWithContact
  onChangeService: (newService: ServiceIdWithContact) => void
  serviceResultCount: {[K in ServiceIdWithContact]?: number | null}
  showServiceResultCount: boolean
  servicesShown?: number
  minimalBorder?: boolean
  offset: number
}

export type IconProps = {
  service: ServiceIdWithContact
  label: Array<string>
  onClick: (s: ServiceIdWithContact) => void
  count: number | null
  showCount: boolean
  isActive: boolean
  minimalBorder?: boolean
  offset: number
}

export class ServiceTabBar extends React.Component<Props> {}
