import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Sb from '../../../../../stories/storybook'
import * as Styles from '../../../../../styles'
import TeamJourney from './index'

const commonProps = {
  cannotWrite: false,
  conversationIDKey: 'dummyConversationIDKey',
  onAuthorClick: Sb.action('onAuthorClick'),
  onDismiss: Sb.action('onDismiss'),
  teamname: 'foo',
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Cards/Team Journey', module)
    .add('Welcome (small team)', () => (
      <TeamJourney
        {...commonProps}
        actions={['wave', {label: 'Publish team on your profile', onClick: Sb.action('onPublishTeam')}]}
        image="icon-illustration-welcome-96"
        textComponent={
          <Kb.Text type="BodySmall">
            <Kb.Emoji allowFontScaling={true} size={Styles.globalMargins.small} emojiName=":wave:" /> Welcome
            to the team! Say hi to everyone and introduce yourself.
          </Kb.Text>
        }
      />
    ))
    .add('Welcome (big team)', () => (
      <TeamJourney
        {...commonProps}
        actions={[
          'wave',
          {label: 'Browse channels', onClick: Sb.action('onBrowseChannels')},
          {label: 'Publish team on your profile', onClick: Sb.action('onPublishTeam')},
        ]}
        image="icon-illustration-welcome-96"
        textComponent={
          <Kb.Text type="BodySmall">
            <Kb.Emoji allowFontScaling={true} size={Styles.globalMargins.small} emojiName=":wave:" /> Welcome
            to the team! Say hi to everyone and introduce yourself.
          </Kb.Text>
        }
      />
    ))
    .add('Popular channels', () => (
      <TeamJourney
        {...commonProps}
        actions={[
          {label: '#one', onClick: Sb.action('onGoToChan')},
          {label: '#two', onClick: Sb.action('onGoToChan')},
          {label: '#three', onClick: Sb.action('onGoToChan')},
        ]}
        image={null}
        textComponent={
          <Kb.Text type="BodySmall">
            You are in <Kb.Text type="BodySmallBold">#somechan</Kb.Text>. Other channels in this team are:
          </Kb.Text>
        }
      />
    ))
    .add('Popular long channels', () => (
      <TeamJourney
        {...commonProps}
        actions={[
          {label: '#1234567890123456789', onClick: Sb.action('onGoToChan')},
          {label: '#2345678901234567890', onClick: Sb.action('onGoToChan')},
          {label: '#3456789012345678901', onClick: Sb.action('onGoToChan')},
        ]}
        image={null}
        textComponent={
          <Kb.Text type="BodySmall">
            You are in <Kb.Text type="BodySmallBold">#somechan</Kb.Text>. Other channels in this team are:
          </Kb.Text>
        }
      />
    ))
    .add('Popular no channels', () => (
      <TeamJourney
        {...commonProps}
        actions={[]}
        image={null}
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
        {...commonProps}
        actions={[{label: 'Add people to the team', onClick: Sb.action('onAddPeopleToTeam')}]}
        image="icon-illustration-friends-96"
        textComponent={
          <Kb.Text type="BodySmall">
            Do you know people interested in joining{' '}
            <Kb.Text onClick={Sb.action('onShowTeam')} type="BodySmallBold">
              foo
            </Kb.Text>
            ?
          </Kb.Text>
        }
      />
    ))
    .add('Add people (open team)', () => (
      <TeamJourney
        {...commonProps}
        actions={[{label: 'Add people to the team', onClick: Sb.action('onAddPeopleToTeam')}]}
        image="icon-illustration-friends-96"
        textComponent={
          <Kb.Text type="BodySmall">
            Do you know people interested in joining?{' '}
            <Kb.Text onClick={Sb.action('onShowTeam')} type="BodySmallBold">
              foo
            </Kb.Text>{' '}
            is open to anyone.
          </Kb.Text>
        }
      />
    ))
    .add('Create channels', () => (
      <TeamJourney
        {...commonProps}
        actions={[{label: 'Create chat channels', onClick: Sb.action('onCreateChatChannels')}]}
        image="icon-illustration-happy-chat-96"
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
        {...commonProps}
        actions={[]}
        image="icon-illustration-attention-64"
        textComponent={<Kb.Text type="BodySmall">One of your messages is getting lots of attention!</Kb.Text>}
      />
    ))
    .add('Inactive channel', () => (
      <TeamJourney
        {...commonProps}
        actions={[]}
        image="icon-illustration-sleepy-96"
        textComponent={
          <Kb.Text type="BodySmall">Zzz… This channel hasn’t been very active…. Revive it?</Kb.Text>
        }
      />
    ))
    .add('Message not answered', () => (
      <TeamJourney
        {...commonProps}
        actions={[
          {label: '#one', onClick: Sb.action('onGoToChan')},
          {label: '#two', onClick: Sb.action('onGoToChan')},
          {label: '#three', onClick: Sb.action('onGoToChan')},
        ]}
        image={null}
        textComponent={
          <Kb.Text type="BodySmall">
            People haven't been talkative in a while. Perhaps post in another channel?
          </Kb.Text>
        }
      />
    ))
}

export default load
