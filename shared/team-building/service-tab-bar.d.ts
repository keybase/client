import type * as React from 'react'
import type * as T from '@/constants/types'

export type Props = {
  services: Array<T.TB.ServiceIdWithContact>
  selectedService: T.TB.ServiceIdWithContact
  onChangeService: (newService: T.TB.ServiceIdWithContact) => void
  servicesShown?: number
  minimalBorder?: boolean
}

export type IconProps = {
  service: T.TB.ServiceIdWithContact
  label: Array<string>
  onClick: (s: T.TB.ServiceIdWithContact) => void
  isActive: boolean
  minimalBorder?: boolean
}

export declare const ServiceTabBar: (p: Props) => React.ReactNode
export default ServiceTabBar
