// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Box} from '../../common-adapters'
import {globalStyles, platformStyles} from '../../styles'
import TabBarRender from '.'

const defaultProps = {
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
  isNew: {},
  onTabClick: Sb.action('onTabClick'),
  selectedTab: 'tabs:chatTab',
  username: 'nathunsmitty',
}

const containerStyle = platformStyles({
  common: {
    alignContent: 'stretch',
    height: '100%',
    width: '100%',
  },
  isElectron: {
    ...globalStyles.flexBoxRow,
  },
  isMobile: {
    ...globalStyles.flexBoxColumn,
  },
})

const container = storyFn => <Box style={containerStyle}>{storyFn()}</Box>

const load = () => {
  Sb.storiesOf('Tab Bar', module)
    .addDecorator(container)
    .add('Normal', () => <TabBarRender {...defaultProps} />)
    .add('With a badge', () => (
      <TabBarRender {...defaultProps} badgeNumbers={{...defaultProps.badgeNumbers, 'tabs:chatTab': 6}} />
    ))
    .add('With a NEW tag', () => <TabBarRender {...defaultProps} isNew={{'tabs:chatTab': true}} />)
}

export default load
