// @flow
import React from 'react'
import {Box} from '../common-adapters'
import {storiesOf, action} from '../stories/storybook'

import Git from '.'

const common = {
  devicename: 'Home Laptop',
  lastEdit: '5 mins',
  name: '',
  teamname: null,
  url: '',
}

const helper = (teamname, name) => ({
  name,
  teamname,
  url: `keybase://${teamname ? `team/${teamname}` : 'private/cecileb'}/${name}.git`,
})

const load = () => {
  storiesOf('Git', module).add('Root', () => (
    <Box style={{width: '100%'}}>
      <Git
        personals={[
          {...common, ...helper(null, 'personal_docs')},
          {...common, ...helper(null, 'taxes')},
          {...common, ...helper(null, 'zork_saves')},
        ]}
        teams={[
          {...common, ...helper('siggis', 'docs')},
          {...common, ...helper('siggis.board', 'media')},
          {...common, ...helper('zorkclub', 'walkthroughs')},
        ]}
        onCopy={action('onCopy')}
        onDelete={action('onDelete')}
      />
    </Box>
  ))
}

export default load
