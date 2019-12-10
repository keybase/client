import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Sb from '../../../../../stories/storybook'
import TeamJourney from './index'

const load = () => {
  Sb.storiesOf('Chat/Conversation/Cards/Team Journey', module)
    .add('Welcome', () => (
      <TeamJourney
        actions={[
          {label: 'Publish team on your own profile', onClick: Sb.action('onPublishTeam')},
          {label: 'Browse channels', onClick: Sb.action('onBrowseChannels')},
        ]}
        image="icon-illustration-welcome-96"
        teamname="foo"
        textComponent={
          <Kb.Text type="BodySmall">Welcome to the team! Say hi to everyone and introduce yourself.</Kb.Text>
        }
      />
    ))
    .add('Popular channels', () => (
      <TeamJourney
        actions={[
          {label: '#one', onClick: Sb.action('onGoToChan')},
          {label: '#two', onClick: Sb.action('onGoToChan')},
          {label: '#three', onClick: Sb.action('onGoToChan')},
        ]}
        image={null}
        teamname="foo"
        textComponent={
          <Kb.Text type="BodySmall">
            You are in <Kb.Text type="BodySmallBold">#somechan</Kb.Text>. Some other channels in this team:
          </Kb.Text>
        }
      />
    ))
    .add('Popular long channels', () => (
      <TeamJourney
        actions={[
          {label: '#1234567890123456789', onClick: Sb.action('onGoToChan')},
          {label: '#2345678901234567890', onClick: Sb.action('onGoToChan')},
          {label: '#3456789012345678901', onClick: Sb.action('onGoToChan')},
        ]}
        image={null}
        teamname="foo"
        textComponent={
          <Kb.Text type="BodySmall">
            You are in <Kb.Text type="BodySmallBold">#somechan</Kb.Text>. Some other channels in this team:
          </Kb.Text>
        }
      />
    ))
    .add('Popular no channels', () => (
      <TeamJourney
        actions={[]}
        image={null}
        teamname="foo"
        textComponent={
          <Kb.Text type="BodySmall">
            You are in <Kb.Text type="BodySmallBold">#somechan</Kb.Text>. And you're in all the other
            channels, nice.
          </Kb.Text>
        }
      />
    ))
    .add('Add people', () => (
      <TeamJourney
        actions={[{label: 'Add people to the team', onClick: Sb.action('onAddPeopleToTeam')}]}
        image="icon-illustration-friends-96"
        teamname="foo"
        textComponent={<Kb.Text type="BodySmall">
            Do you know people interested in joining{' '}
            <Kb.Text onClick={Sb.action('onShowTeam')} type="BodySmallBold">
              foo
            </Kb.Text>?
          </Kb.Text>}
      />
    ))
    .add('Add people (open team)', () => (
      <TeamJourney
        actions={[{label: 'Add people to the team', onClick: Sb.action('onAddPeopleToTeam')}]}
        image="icon-illustration-friends-96"
        teamname="foo"
        textComponent={<Kb.Text type="BodySmall">
          Do you know people interested in joining?{' '}
          <Kb.Text onClick={Sb.action('onShowTeam')} type="BodySmallBold">
            foo
          </Kb.Text>{' '}
          is open to anyone.
        </Kb.Text>}
      />
    ))
    .add('Create channels', () => (
      <TeamJourney
        actions={[{label: 'Create chat channels', onClick: Sb.action('onCreateChatChannels')}]}
        image="icon-illustration-happy-chat-96"
        teamname="foo"
        textComponent={
          <Kb.Text type="BodySmall">
            Go ahead and create <Kb.Text type="BodySmallBold">#channels</Kb.Text> around topics you think are
            missing.
          </Kb.Text>
        }
      />
    ))
    .add('Lots of attention', () => (
      <TeamJourney
        actions={[]}
        image="icon-illustration-attention-64"
        teamname="foo"
        textComponent={<Kb.Text type="BodySmall">One of your messages is getting lots of attention!</Kb.Text>}
      />
    ))
    .add('Inactive channel', () => (
      <TeamJourney
        actions={[]}
        image="icon-illustration-sleepy-96"
        teamname="foo"
        textComponent={
          <Kb.Text type="BodySmall">Zzz… This channel hasn’t been very active…. Revive it?</Kb.Text>
        }
      />
    ))
    .add('Message not answered', () => (
      <TeamJourney
        actions={[
          {label: '#one', onClick: Sb.action('onGoToChan')},
          {label: '#two', onClick: Sb.action('onGoToChan')},
          {label: '#three', onClick: Sb.action('onGoToChan')},
        ]}
        image={null}
        teamname="foo"
        textComponent={
          <Kb.Text type="BodySmall">
            People haven't been talkative in a while. Perhaps post in another channel?
          </Kb.Text>
        }
      />
    ))
}

export default load
