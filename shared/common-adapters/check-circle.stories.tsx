import Box from './box'
import CheckCircle from './check-circle'
import * as React from 'react'
import * as Sb from '../stories/storybook'
import * as Styles from '../styles'

const commonProps = {
  disabled: false,
  onCheck: Sb.action('onCheck'),
  style: {margin: 10},
}

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Check Circle', () => (
      <Box style={{flex: 1}}>
        <CheckCircle {...commonProps} checked={false} />
        <CheckCircle {...commonProps} checked={true} />
        <CheckCircle {...commonProps} checked={false} disabled={true} />
        <CheckCircle {...commonProps} checked={true} disabled={true} />
        <CheckCircle
          {...commonProps}
          checked={true}
          disabled={true}
          disabledColor={Styles.globalColors.black_20OrWhite_20}
        />
      </Box>
    ))
}

export default load
