// @flow
import React from 'react'
import * as Types from '../constants/types/fs'
import {Box} from '../common-adapters'
import {storiesOf} from '../stories/storybook'
import Files from '.'

const load = () => {
  storiesOf('Files', module).add('Root', () => (
    <Box style={{width: '100%'}}>
      <Files path={Types.stringToPath('/keybase')} items={[]} onBack={() => {}} />
      <Files path={Types.stringToPath('/keybase/private')} items={[]} onBack={() => {}} />
      <Files path={Types.stringToPath('/keybase/public')} items={[]} onBack={() => {}} />
    </Box>
  ))
}

export default load
