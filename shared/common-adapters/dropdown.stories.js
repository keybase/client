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
        borderColor: globalColors.black_10,
      }}
    >
      <Dropdown
        items={[
          <Text type="BodyBig" key="pick">
            Pick a value
          </Text>,
          <Text type="BodyBig" key="one">
            One
          </Text>,
          <Text type="BodyBig" key="two">
            Two
          </Text>,
          <Text type="BodyBig" key="three">
            Three
          </Text>,
        ]}
        onChanged={action('onChanged')}
      />
      <Dropdown
        items={[
          <Text type="BodyBig" key="pick">
            Pick a value
          </Text>,
          <Text type="BodyBig" key="one">
            One
          </Text>,
          <Text type="BodyBig" key="two">
            Two
          </Text>,
          <Text type="BodyBig" key="trhee">
            Three
          </Text>,
        ]}
        onChanged={action('onChanged')}
        selected={<Text type="BodyBig">Pick a value</Text>}
        style={{marginTop: 100}}
      />
      <Dropdown
        items={[
          <Text type="BodyBig" key="pick">
            Pick a value
          </Text>,
          <Text type="BodyBig" key="one">
            One
          </Text>,
          <Text type="BodyBig" key="two">
            Two
          </Text>,
          <Text type="BodyBig" key="trhee">
            Three
          </Text>,
        ]}
        onChanged={action('onChanged')}
        selected={<Text type="BodyBig">Pick a value</Text>}
        style={{marginTop: 100}}
        disabled={true}
      />
    </Box>
  ))
}

export default load
