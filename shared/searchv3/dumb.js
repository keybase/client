// @flow
import ServicesFilter from './services-filter'
import type {DumbComponentMap} from '../constants/types/more'

const commonServicesFilterMapProps = {
  onSelectService: service => console.log(`Clicked ${service}`),
}

const servicesFilterMap: DumbComponentMap<ServicesFilter> = {
  component: ServicesFilter,
  mocks: {
    Keybase: {
      ...commonServicesFilterMapProps,
      selectedService: 'Keybase',
    },
    Twitter: {
      ...commonServicesFilterMapProps,
      selectedService: 'Twitter',
    },
    Facebook: {
      ...commonServicesFilterMapProps,
      selectedService: 'Facebook',
    },
    GitHub: {
      ...commonServicesFilterMapProps,
      selectedService: 'GitHub',
    },
    Reddit: {
      ...commonServicesFilterMapProps,
      selectedService: 'Reddit',
    },
    'Hacker News': {
      ...commonServicesFilterMapProps,
      selectedService: 'Hacker News',
    },
  },
}

export default {
  'SearchV3 filter': servicesFilterMap,
}
