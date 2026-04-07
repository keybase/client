import type * as React from 'react'
import type * as T from '@/constants/types'
import {ServiceTabBar} from './service-tab-bar'
import * as TeamBuilding from '@/stores/team-building'

const getVisibleServices = (filterServices?: Array<T.TB.ServiceIdWithContact>) =>
  filterServices
    ? TeamBuilding.allServices.filter(serviceId => filterServices.includes(serviceId))
    : TeamBuilding.allServices

export const FilteredServiceTabBar = (
  props: Omit<React.ComponentPropsWithoutRef<typeof ServiceTabBar>, 'services'> & {
    filterServices?: Array<T.TB.ServiceIdWithContact>
  }
) => {
  const {selectedService, onChangeService, servicesShown, minimalBorder, offset, filterServices} = props
  const services = getVisibleServices(filterServices)

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
