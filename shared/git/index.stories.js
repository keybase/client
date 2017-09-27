// @flow
import React from 'react'
import {Box} from '../common-adapters'
import {storiesOf, action} from '../stories/storybook'

// import Git from '.'
import NewRepo from './new-repo'
import DeleteRepo from './delete-repo'

// const common = {
// devicename: 'Home Laptop',
// isNew: false,
// lastEditTime: '5 mins',
// lastEditUser: 'max',
// lastEditUserFollowing: true,
// name: '',
// teamname: null,
// url: '',
// }

// const helper = (teamname, name) => ({
// name,
// teamname,
// url: `keybase://${teamname ? `team/${teamname}` : 'private/cecileb'}/${name}.git`,
// })

const load = () => {
  storiesOf('Git', module)
    .add('Root', () => (
      <Box style={{width: '100%'}}>
        {/* // commented out due to this being connected now and we need a good story for how inner connected components work in mock
          // TODO put this back when we have that figured out
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
          setTimeout={action('setTimeout')}
        />
        */}
      </Box>
    ))
    .add('NewPersonalRepo', () => (
      <Box style={{height: 500, width: '100%'}}>
        <NewRepo
          isTeam={false}
          onCreate={action('onCreate')}
          onClose={action('onClose')}
          onNewTeam={action('onNewTeam')}
          loading={false}
          error={null}
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
          loading={false}
          error={null}
        />
      </Box>
    ))
    .add('DeleteRepo', () => (
      <Box style={{height: '100%', width: '100%'}}>
        <DeleteRepo
          name="docs"
          onClose={action('onClose')}
          onDelete={action('onDelete')}
          loading={false}
          error={null}
        />
      </Box>
    ))
    .add('DeleteTeamRepo', () => (
      <Box style={{height: '100%', width: '100%'}}>
        <DeleteRepo
          teamname="siggis.board"
          name="media"
          onClose={action('onClose')}
          onDelete={action('onDelete')}
          loading={false}
          error={null}
        />
      </Box>
    ))
}

export default load
