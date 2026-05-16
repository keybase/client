import type * as T from '@/constants/types'
import type {SharedValue} from '@/common-adapters/reanimated'

export type IconProps = {
  service: T.TB.ServiceIdWithContact
  label: Array<string>
  onClick: (s: T.TB.ServiceIdWithContact) => void
  isActive: boolean
  minimalBorder?: boolean
  offset?: SharedValue<number>
}

export type Props = {
  services: Array<T.TB.ServiceIdWithContact>
  selectedService: T.TB.ServiceIdWithContact
  onChangeService: (newService: T.TB.ServiceIdWithContact) => void
  servicesShown?: number
  minimalBorder?: boolean
  offset?: SharedValue<number>
}
