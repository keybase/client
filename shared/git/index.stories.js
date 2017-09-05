// @flow
import React from 'react'
import {Box} from '../common-adapters'
import {storiesOf, action} from '../stories/storybook'

import Git from '.'
import NewRepo from './new-repo'

const common = {
  devicename: 'Home Laptop',
  isNew: false,
  lastEditTime: '5 mins',
  lastEditUser: 'max',
  lastEditUserFollowing: true,
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
  storiesOf('Git', module)
    .add('Root', () => (
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
            {...common, ...helper('zorkclub', 'walkthroughs'), isNew: true},
            {...common, ...helper('notfollowingmax', 'test'), lastEditUserFollowing: false},
          ]}
          onCopy={action('onCopy')}
          onDelete={action('onDelete')}
          onNewPersonalRepo={action('onNewPersonalRepo')}
          onNewTeamRepo={action('onNewTeamRepo')}
        />
      </Box>
    ))
    .add('NewPersonalRepo', () => (
      <Box style={{height: 500, width: '100%'}}>
        <NewRepo
          isTeam={false}
          onCreate={action('onCreate')}
          onClose={action('onClose')}
          onNewTeam={action('onNewTeam')}
        />
      </Box>
    ))
    .add('NewTeamRepo', () => (
      <Box style={{height: '100%', width: '100%'}}>
        <NewRepo
          isTeam={true}
          onClose={action('onClose')}
          onCreate={action('onCreate')}
          onNewTeam={action('onNewTeam')}
          teams={['fortgreenmoms', 'siggis', 'siggis.board']}
        />
      </Box>
    ))
}

export default load
