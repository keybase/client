import * as React from 'react'
import * as Sb from '../stories/storybook'
import Box, {Box2} from './box'
import Text from './text'
import SearchFilter from './search-filter'
import * as Styles from '../styles'

const Kb = {
  Box,
  Box2,
  SearchFilter,
  Text,
}

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('SearchFilter', () => (
      <Kb.Box2 direction="vertical" fullWidth={true} gap="small" gapStart={true}>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="small" alignItems="center">
          <Kb.Text type="Body">Small</Kb.Text>
          <Kb.SearchFilter
            size="small"
            hotkey="k"
            icon="iconfont-search"
            placeholderText="Search in the universe"
            onChange={Sb.action('onChange')}
            waiting={true}
          />
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="small" alignItems="center">
          <Kb.Text type="Body">Full-width</Kb.Text>
          <Kb.SearchFilter
            size="full-width"
            hotkey="k"
            icon="iconfont-search"
            placeholderText="Search in the universe"
            onChange={Sb.action('onChange')}
            waiting={true}
          />
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="small" alignItems="center">
          <Kb.Text type="Body">with onClick</Kb.Text>
          <Kb.SearchFilter
            size="full-width"
            hotkey="k"
            icon="iconfont-search"
            placeholderText="Search in the universe"
            onChange={Sb.action('onChange')}
            onClick={Sb.action('onClick')}
            waiting={true}
          />
        </Kb.Box2>
        <Kb.SearchFilter
          size="full-width"
          hotkey="k"
          icon="iconfont-search"
          placeholderText="Search in the universe (by itself in a column flex box)"
          onChange={Sb.action('onChange')}
        />
        <Kb.Box style={{backgroundColor: Styles.globalColors.blue, padding: Styles.globalMargins.large}}>
          <Kb.SearchFilter
            size="small"
            hotkey="k"
            icon="iconfont-search"
            waiting={true}
            negative={true}
            placeholderText="Search in the universe"
            onChange={Sb.action('onChange')}
          />
        </Kb.Box>
      </Kb.Box2>
    ))
    .add('SearchFilter - Mobile', () => (
      <Kb.Box2 direction="vertical" fullWidth={true} gap="small" gapStart={true}>
        <Kb.SearchFilter
          size="small"
          icon="iconfont-search"
          placeholderText="Search"
          onChange={Sb.action('onChange')}
        />
        <Kb.SearchFilter
          size="small"
          icon="iconfont-search"
          placeholderText="Search"
          onChange={Sb.action('onChange')}
          waiting={true}
        />
        <Kb.Box style={{backgroundColor: Styles.globalColors.blue}}>
          <Kb.SearchFilter
            size="small"
            icon="iconfont-search"
            placeholderText="Search"
            onChange={Sb.action('onChange')}
            negative={true}
          />
        </Kb.Box>
        <Kb.Box style={{backgroundColor: Styles.globalColors.blue}}>
          <Kb.SearchFilter
            size="small"
            icon="iconfont-search"
            placeholderText="Search"
            onChange={Sb.action('onChange')}
            waiting={true}
            negative={true}
          />
        </Kb.Box>
      </Kb.Box2>
    ))
}

export default load
