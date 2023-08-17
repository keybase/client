import * as React from 'react'
import type * as T from '../constants/types'
import * as Constants from '../constants/team-building'
import {ServiceTabBar} from './service-tab-bar'

export const FilteredServiceTabBar = (
  props: Omit<React.ComponentPropsWithoutRef<typeof ServiceTabBar>, 'services'> & {
    filterServices?: Array<T.TB.ServiceIdWithContact>
  }
) => {
  const {selectedService, onChangeService} = props
  const {servicesShown, minimalBorder, offset, filterServices} = props

  const services = React.useMemo(
    () =>
      filterServices
        ? Constants.allServices.filter(serviceId => filterServices?.includes(serviceId))
        : Constants.allServices,
    [filterServices]
  )
  return services.length === 1 && services[0] === 'keybase' ? null : (
    <ServiceTabBar
      services={services}
      selectedService={selectedService}
      onChangeService={onChangeService}
      servicesShown={servicesShown}
      minimalBorder={minimalBorder}
      offset={offset}
    />
  )
}
