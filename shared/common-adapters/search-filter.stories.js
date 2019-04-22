// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import Box, {Box2} from './box'
import Text from './text'
import SearchFilter from './search-filter'
import * as Styles from '../styles'

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('SearchFilter', () => (
      <Box2 direction="vertical" fullWidth={true} gap="small" gapStart={true}>
        <Box2 direction="horizontal" fullWidth={true} gap="small" alignItems="center">
          <Text type="Body">Small</Text>
          <SearchFilter
            hotkey="k"
            icon="iconfont-search"
            placeholderText="Search in the universe"
            onChange={Sb.action('onChange')}
            type="Small"
            waiting={true}
          />
        </Box2>
        <Box2 direction="horizontal" fullWidth={true} gap="small" alignItems="center">
          <Text type="Body">Full-width</Text>
          <SearchFilter
            hotkey="k"
            icon="iconfont-search"
            placeholderText="Search in the universe"
            onChange={Sb.action('onChange')}
            type="Full-width"
            waiting={true}
          />
        </Box2>
        <Box2 direction="horizontal" fullWidth={true} gap="small" alignItems="center">
          <Text type="Body">with onClick</Text>
          <SearchFilter
            hotkey="k"
            icon="iconfont-search"
            placeholderText="Search in the universe"
            onChange={Sb.action('onChange')}
            onClick={Sb.action('onClick')}
            type="Full-width"
            waiting={true}
          />
        </Box2>
        <SearchFilter
          hotkey="k"
          icon="iconfont-search"
          placeholderText="Search in the universe (by itself in a column flex box)"
          onChange={Sb.action('onChange')}
          type="Full-width"
        />
        <Box style={{backgroundColor: Styles.globalColors.blue, padding: Styles.globalMargins.large}}>
          <SearchFilter
            hotkey="k"
            icon="iconfont-search"
            waiting={true}
            negative={true}
            placeholderText="Search in the universe"
            onChange={Sb.action('onChange')}
            type="Small"
          />
        </Box>
      </Box2>
    ))
    .add('SearchFilter - Mobile', () => (
      <Box2 direction="vertical" fullWidth={true} gap="small" gapStart={true}>
        <SearchFilter
          icon="iconfont-search"
          placeholderText="Search"
          onChange={Sb.action('onChange')}
          type="Mobile"
        />
        <SearchFilter
          icon="iconfont-search"
          placeholderText="Search"
          onChange={Sb.action('onChange')}
          type="Mobile"
          waiting={true}
        />
        <Box style={{backgroundColor: Styles.globalColors.blue}}>
          <SearchFilter
            icon="iconfont-search"
            placeholderText="Search"
            onChange={Sb.action('onChange')}
            type="Mobile"
            negative={true}
          />
        </Box>
        <Box style={{backgroundColor: Styles.globalColors.blue}}>
          <SearchFilter
            icon="iconfont-search"
            placeholderText="Search"
            onChange={Sb.action('onChange')}
            type="Mobile"
            waiting={true}
            negative={true}
          />
        </Box>
      </Box2>
    ))
}

export default load
