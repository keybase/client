import * as React from 'react'
import Box from './box'
import Text from './text'
import PopupDialog from './popup-dialog'
import {action, storiesOf} from '../stories/storybook'
import {globalStyles, globalColors} from '../styles'

const load = () => {
  storiesOf('Common', module).add('PopupDialog', () => (
    <Box
      style={{
        height: 300,
        position: 'relative',
        width: 300,
      }}
    >
      <PopupDialog onClose={action('onClose')}>
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            alignItems: 'center',
            backgroundColor: globalColors.white,
            height: 200,
            justifyContent: 'center',
            width: 200,
          }}
        >
          <Text type="Body">Hello, world!</Text>
        </Box>
      </PopupDialog>
    </Box>
  ))
}

export default load
