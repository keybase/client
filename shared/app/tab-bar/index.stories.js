// @flow
import * as React from 'react'
import {action, storiesOf, PropProviders} from '../../stories/storybook'
import {Box} from '../../common-adapters'
import {globalStyles, platformStyles} from '../../styles'
import TabBarRender from '.'

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
    style={platformStyles({
      common: {
        alignContent: 'stretch',
        height: '100%',
        width: '100%',
      },
      isElectron: {
        ...globalStyles.flexBoxRow,
      },
      isMobile: {
        marginTop: 40,
        ...globalStyles.flexBoxColumn,
      },
    })}
  >
    {storyFn()}
  </Box>
)

const load = () => {
  storiesOf('Tab Bar', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
    .addDecorator(container)
    .add('Normal', () => <TabBarRender {...defaultProps} />)
    .add('With a badge', () => (
      <TabBarRender {...defaultProps} badgeNumbers={{...defaultProps.badgeNumbers, 'tabs:chatTab': 6}} />
    ))
}

export default load
