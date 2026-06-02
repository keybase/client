import type {Meta, StoryObj} from '@storybook/react'
import type * as T from '@/constants/types'
import {ServiceTabBar} from './service-tab-bar'

const allServices: Array<T.TB.ServiceIdWithContact> = [
  'keybase',
  'phone',
  'email',
  'twitter',
  'github',
  'reddit',
  'hackernews',
]

const meta: Meta<typeof ServiceTabBar> = {
  component: ServiceTabBar,
  title: 'TeamBuilding/ServiceTabBar',
  args: {
    services: allServices,
    selectedService: 'keybase',
    onChangeService: () => {},
  },
}
export default meta
type Story = StoryObj<typeof ServiceTabBar>

export const KeybaseSelected: Story = {
  args: {selectedService: 'keybase'},
}

export const TwitterSelected: Story = {
  args: {selectedService: 'twitter'},
}

export const PhoneSelected: Story = {
  args: {selectedService: 'phone'},
}

export const EmailSelected: Story = {
  args: {selectedService: 'email'},
}

export const FewServices: Story = {
  args: {
    services: ['keybase', 'twitter', 'github'] as Array<T.TB.ServiceIdWithContact>,
    selectedService: 'keybase',
  },
}

export const WithServicesShown: Story = {
  args: {
    services: allServices,
    selectedService: 'keybase',
    servicesShown: 3,
  },
}

export const MinimalBorder: Story = {
  args: {
    selectedService: 'github',
    minimalBorder: true,
  },
}
