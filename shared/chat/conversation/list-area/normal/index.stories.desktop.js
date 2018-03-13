// @flow
import * as React from 'react'
import ThreadView from './thread-view.desktop'
import {Box} from '../../../../common-adapters'
import {storiesOf} from '../../../../stories/storybook'
import {globalMargins, globalStyles, globalColors} from '../../../../styles'

const load = () =>
  storiesOf('threadView', module).add('threadView', () => (
    <Box style={{...globalStyles.flexBoxCenter, width: '75%', height: '75%'}}>
      <ThreadView />
    </Box>
  ))

export default load
