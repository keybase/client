// @flow
import * as React from 'react'
import {action, storiesOf, createPropProvider} from '../../stories/storybook'
import * as PropProviders from '../../stories/prop-providers'
import {Box} from '../../common-adapters'
import {globalStyles} from '../../styles'
import TabBarRender from '.'

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

const container = storyFn => (
  <Box
    style={{
      ...globalStyles.flexBoxRow,
      alignContent: 'stretch',
      height: '100%',
    }}
  >
    {storyFn()}
  </Box>
)

const load = () => {
  storiesOf('Tab Bar', module)
    .addDecorator(provider)
    .addDecorator(container)
    .add('Normal', () => <TabBarRender {...defaultProps} />)
    .add('With a badge', () => (
      <TabBarRender {...defaultProps} badgeNumbers={{...defaultProps.badgeNumbers, 'tabs:chatTab': 6}} />
    ))
}

export default load
