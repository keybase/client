// @flow
import * as React from 'react'
import {storiesOf, action} from '../stories/storybook'
import {Box2, BackButton} from '.'
import {globalColors} from '../styles'

const defaultProps = {
  badgeNumber: 0,
  onClick: action('onClick'),
  onPress: action('onPress'),
}

const load = () => {
  storiesOf('Common', module).add('Back Button', () => (
    <Box2 direction="vertical">
      <BackButton {...defaultProps} />
      <BackButton {...defaultProps} badgeNumber={5} />
      <BackButton {...defaultProps} title="Title goes here" />
      <BackButton {...defaultProps} iconColor={globalColors.red} />
    </Box2>
  ))
}

export default load
