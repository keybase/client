import newRepo from './new-repo/index.stories'
import deleteRepo from './delete-repo/index.stories'
import * as Sb from '../stories/storybook'
import * as React from 'react'
import List from '.'

const props = {
  clearBadges: Sb.action('clearBadges'),
  expandedSet: new Set<string>(),
  loading: false,
  onNewPersonalRepo: Sb.action('onNewPersonalRepo'),
  onNewTeamRepo: Sb.action('onNewTeamRepo'),
  onShowDelete: Sb.action('onShowDelete'),
  onToggleExpand: Sb.action('onToggleExpand'),
  personals: ['personal1', 'personal2', 'personal3', 'personal4'],
  teams: ['team1', 'team2', 'team3', 'team4'],
}

const Provider = {
  GitRow: props => ({
    _onOpenChannelSelection: Sb.action('_onOpenChannelSelection'),
    canDelete: false,
    canEdit: false,
    channelName: '#general',
    chatDisabled: false,
    devicename: 'a',
    expanded: props.expanded,
    isNew: false,
    lastEditTime: 0,
    lastEditUser: 'a',
    lastEditUserFollowing: false,
    name: props.id,
    onBrowseGitRepo: Sb.action('onBrowseGitRepo'),
    onClickDevice: Sb.action('onClickDevice'),
    onCopy: Sb.action('onCopy'),
    onShowDelete: Sb.action('onShowDelete'),
    onToggleChatEnabled: Sb.action('onToggleChatEnabled'),
    onToggleExpand: Sb.action('onToggleExpand'),
    openUserTracker: Sb.action('openUserTracker'),
    teamname: props.id.startsWith('team') ? 'team' : null,
    url: 'a url for you to click on one two three four five end!',
    you: 'username',
  }),
}

const load = () => {
  deleteRepo()
  newRepo()

  Sb.storiesOf('Git/List', module)
    .addDecorator(Sb.createPropProviderWithCommon(Provider))
    .add('Normal', () => <List {...props} />)
    .add('Expanded', () => <List {...props} expandedSet={new Set(['personal2', 'team3'])} />)
}

export default load
