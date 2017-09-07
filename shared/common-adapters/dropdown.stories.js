// @flow
import React from 'react'
import Box from './box'
import Text from './text'
import {globalStyles, globalColors} from '../styles'
import {storiesOf, action} from '../stories/storybook'
import Dropdown from './dropdown'

const load = () => {
  storiesOf('Common', module).add('Dropdown', () => (
    <Box
      style={{
        ...globalStyles.flexBoxCenter,
        ...globalStyles.flexBoxColumn,
        width: 400,
        height: 400,
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: globalColors.black_05,
      }}
    >
      <Dropdown
        items={[
          <Text type="Header" key="pick">Pick a value</Text>,
          <Text type="Header" key="one">One</Text>,
          <Text type="Header" key="two">Two</Text>,
          <Text type="Header" key="three">Three</Text>,
        ]}
        onChanged={action('onChanged')}
      />
      <Dropdown
        items={[
          <Text type="Header" key="pick">Pick a value</Text>,
          <Text type="Header" key="one">One</Text>,
          <Text type="Header" key="two">Two</Text>,
          <Text type="Header" key="trhee">Three</Text>,
        ]}
        onChanged={action('onChanged')}
        selected={<Text type="Header">Pick a value</Text>}
        style={{marginTop: 100}}
      />
    </Box>
  ))
}

export default load
