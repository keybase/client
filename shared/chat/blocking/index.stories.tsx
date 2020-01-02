/* eslint-disable sort-keys */
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import BlockModal from './block-modal/container'
import Invitation from './invitation-to-block'
import * as Container from '../../util/container'
import * as Constants from '../../constants/chat2'

const others = ['max', 'patrick', 'strib']
const fakeConvID = 'fakeConvID1234'
const fakeTeamID = 'fakeTeamID5678'

const common = Sb.createStoreWithCommon()

const store = Container.produce(common, draftState => {
  draftState.chat2.blockButtonsMap.set(fakeTeamID, {adder: 'chris'})
  const withOthersMeta = Constants.makeConversationMeta()
  withOthersMeta.teamID = fakeTeamID
  const withOthersParts = ['chris', 'max', 'patrick']
  const withOthersPartInfo = {
    all: withOthersParts,
    name: withOthersParts,
    contactName: new Map(),
  }
  draftState.chat2.metaMap.set('withOthers', withOthersMeta)
  draftState.chat2.participantMap.set('withOthers', withOthersPartInfo)

  const justChrisMeta = Constants.makeConversationMeta()
  justChrisMeta.teamID = fakeTeamID
  const justChrisParts = ['chris']
  const justChrisPartInfo = {
    all: justChrisParts,
    name: justChrisParts,
    contactName: new Map(),
  }
  draftState.chat2.metaMap.set('justChris', justChrisMeta)
  draftState.chat2.participantMap.set('justChris', justChrisPartInfo)

  const teamMeta = Constants.makeConversationMeta()
  teamMeta.teamID = fakeTeamID
  teamMeta.teamname = 'teamteamteam'
  const teamParts = ['chris', 'max', 'patrick']
  const teamPartInfo = {
    all: teamParts,
    name: teamParts,
    contactName: new Map(),
  }
  draftState.chat2.metaMap.set('team', teamMeta)
  draftState.chat2.participantMap.set('team', teamPartInfo)
})

const load = () => {
  Sb.storiesOf('Chat/Blocking', module)
    .add('Implicit team', () => (
      <BlockModal
        {...Sb.createNavigator({username: 'chris', others, blockUserByDefault: true, convID: fakeConvID})}
      />
    ))
    .add('Implicit team from sidebar', () => (
      <BlockModal {...Sb.createNavigator({others, blockUserByDefault: true, convID: fakeConvID})} />
    ))
    .add('Team', () => (
      <BlockModal
        {...Sb.createNavigator({
          username: 'chris',
          team: 'keybase',
          blockUserByDefault: true,
          convID: fakeConvID,
        })}
      />
    ))
    .add('1on1', () => (
      <BlockModal
        {...Sb.createNavigator({username: 'chris', blockUserByDefault: true, convID: fakeConvID})}
      />
    ))
    .add('From profile', () => <BlockModal {...Sb.createNavigator({username: 'chris'})} />)
  Sb.storiesOf('Chat/Blocking', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Implicit team invitation', () => <Invitation conversationID="withOthers" />)
    .add('Team invitation', () => <Invitation conversationID="team" />)
    .add('1on1 invitation', () => <Invitation conversationID="justChris" />)
}

export default load
