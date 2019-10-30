import * as React from 'react'
import * as Sb from '../../../../../stories/storybook'
import TeamJourney from './index'

const load = () => {
  Sb.storiesOf('Chat/Conversation/Cards/Team Journey', module)
    .add('Welcome', () => (
      <TeamJourney
        actions={[
          { label: 'Publish team on your own profile', onClick: Sb.action('onPublishTeam') },
          { label: 'Browse channels', onClick: Sb.action('onBrowseChannels') },
        ]}
        image={''}
        loadTeam={null}
        teamname="foo"
        text="Welcome to the team! Say hi to everyone and introduce yourself."
      />
    ))
  .add('Popular channels', () => (
    <TeamJourney
      actions={[
        { label: '#one', onClick: Sb.action('onGoToChan') },
        { label: '#two', onClick: Sb.action('onGoToChan') },
        { label: '#three', onClick: Sb.action('onGoToChan') },
      ]}
      image={''}
      loadTeam={null}
      teamname="foo"
      text="You are in #somechan. Some popular channels in this team:"
    />
  ))
  .add('Add people', () => (
    <TeamJourney
      actions={[{ label: 'Add people to the team', onClick: Sb.action('onAddPeopleToTeam') }]}
      image=""
      loadTeam={null}
      teamname="foo"
      text="Do you know people interested in joining? Foo is open to anyone."
    />
  ))
  .add('Create channels', () => (
    <TeamJourney
      actions={[{ label: 'Create chat channels', onClick: Sb.action('onCreateChatChannels') }]}
      image=""
      loadTeam={null}
      teamname="foo"
      text="Go ahead and create #channels around topics you think are missing."
    />
  ))
  .add('Lots of attention', () => (
    <TeamJourney
      actions={[]}
      image=""
      loadTeam={null}
      teamname="foo"
      text="One of your messages is getting lots of attention!"
    />
  ))
  .add('Inactive channel', () => (
    <TeamJourney
      actions={[]}
      image=""
      loadTeam={null}
      teamname="foo"
      text="Zzz… This channel hasn’t been very active…. Revive it?"
    />
  ))
  .add('Message not answered', () => (
    <TeamJourney
      actions={[
        { label: '#one', onClick: Sb.action('onGoToChan') },
        { label: '#two', onClick: Sb.action('onGoToChan') },
        { label: '#three', onClick: Sb.action('onGoToChan') },
      ]}
      image=""
      loadTeam={null}
      teamname="foo"
      text="People haven't been talkative in a while. Perhaps post in another channel?"
    />
  ))
}

export default load
