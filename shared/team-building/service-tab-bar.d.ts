import * as React from 'react'
import type {ServiceIdWithContact} from '../constants/types/team-building'
import type {SharedValue} from '../common-adapters/reanimated'

export type Props = {
  services: Array<ServiceIdWithContact>
  selectedService: ServiceIdWithContact
  onChangeService: (newService: ServiceIdWithContact) => void
  servicesShown?: number
  minimalBorder?: boolean
  offset?: SharedValue<number>
}

export type IconProps = {
  service: ServiceIdWithContact
  label: Array<string>
  onClick: (s: ServiceIdWithContact) => void
  isActive: boolean
  minimalBorder?: boolean
  offset?: SharedValue<number>
}

export class ServiceTabBar extends React.Component<Props> {}
