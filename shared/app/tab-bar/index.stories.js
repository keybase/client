// @flow
import * as React from 'react'
import {action, storiesOf, createPropProvider} from '../../stories/storybook'
import TabBarRender from '.'
import * as PropProviders from '../../stories/prop-providers'
import {Box} from '../../common-adapters'

const provider = createPropProvider(PropProviders.Common())

const defaultProps = {
  onTabClick: action('onTabClick'),
  selectedTab: 'tabs:chatTab',
  username: 'nathunsmitty',
  badgeNumbers: {
    'tabs:chatTab': 0,
    'tabs:devicesTab': 0,
    'tabs:folderTab': 0,
    'tabs:fsTab': 0,
    'tabs:gitTab': 0,
    'tabs:loginTab': 0,
    'tabs:peopleTab': 0,
    'tabs:profileTab': 0,
    'tabs:searchTab': 0,
    'tabs:settingsTab': 0,
    'tabs:teamsTab': 0,
    'tabs:walletsTab': 0,
  },
}

const Container = storyFn => <Box style={{height: '100%', width: '100%'}}>{storyFn()}</Box>

const load = () => {
  storiesOf('Tab Bar', module)
    .addDecorator(provider)
    .addDecorator(Container)
    .add('Normal', () => <TabBarRender {...defaultProps} />)
    .add('With a badge', () => (
      <TabBarRender {...defaultProps} badgeNumbers={{...defaultProps.badgeNumbers, 'tabs:chatTab': 6}} />
    ))
}

export default load
