import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import {serviceIdToIconFont, serviceIdToAccentColor, serviceIdToLabel} from './shared'
import * as Constants from '../constants/team-building'
import {ServiceIdWithContact, AllowedNamespace} from '../constants/types/team-building'

export type Props = {
  services: Array<ServiceIdWithContact>
  selectedService: ServiceIdWithContact
  onChangeService: (newService: ServiceIdWithContact) => void
  serviceResultCount: {[K in ServiceIdWithContact]?: number | null}
  showServiceResultCount: boolean
  servicesShown?: number
  minimalBorder?: boolean
  offset?: any
}

export type IconProps = {
  service: ServiceIdWithContact
  label: Array<string>
  onClick: (s: ServiceIdWithContact) => void
  count: number | null
  showCount: boolean
  isActive: boolean
  minimalBorder?: boolean
  offset?: any
}

export class ServiceTabBar extends React.Component<Props> {}
