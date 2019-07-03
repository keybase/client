import * as React from 'react'
import * as Sb from '../stories/storybook'
import {Box2, BackButton} from '.'
import {globalColors} from '../styles'

const defaultProps = {
  badgeNumber: 0,
  onClick: Sb.action('onClick'),
  onPress: Sb.action('onPress'),
}

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Back Button', () => (
      <Box2 direction="vertical">
        <BackButton {...defaultProps} />
        <BackButton {...defaultProps} badgeNumber={5} />
        <BackButton {...defaultProps} title="Title goes here" />
        <BackButton {...defaultProps} iconColor={globalColors.red} />
      </Box2>
    ))
}

export default load
