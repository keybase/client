import type {Meta, StoryObj} from '@storybook/react'
import type * as T from '@/constants/types'
import {FilteredServiceTabBar} from './filtered-service-tab-bar'

const meta: Meta<typeof FilteredServiceTabBar> = {
  component: FilteredServiceTabBar,
  title: 'TeamBuilding/FilteredServiceTabBar',
  args: {
    selectedService: 'keybase',
    onChangeService: () => {},
  },
}
export default meta
type Story = StoryObj<typeof FilteredServiceTabBar>

export const AllServices: Story = {}

export const KeybaseOnly: Story = {
  // Returns null (single keybase service), rendered as empty
  args: {filterServices: ['keybase'] as Array<T.TB.ServiceIdWithContact>},
}

export const SocialServicesOnly: Story = {
  args: {
    filterServices: ['twitter', 'github', 'reddit'] as Array<T.TB.ServiceIdWithContact>,
    selectedService: 'twitter',
  },
}

export const ContactServicesOnly: Story = {
  args: {
    filterServices: ['phone', 'email'] as Array<T.TB.ServiceIdWithContact>,
    selectedService: 'phone',
  },
}
