import * as React from 'react'
import * as Container from '../util/container'
import * as Tracker2Constants from '../constants/tracker2'
import * as Tracker2Types from '../constants/types/tracker2'
import * as Sb from '../stories/storybook'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import ProfileCard from './profile-card'

const username = 't_alice'
const commonBroken: Container.TypedState = Sb.createStoreWithCommon()
const commonValid = Container.produce(commonBroken, (draftState: Container.TypedState) => {
  const details = Tracker2Constants.getDetails(draftState, username)
  details.assertions?.set('twitter:alice', {
    ...details.assertions?.get('twitter:alice'),
    state: 'valid',
  } as Tracker2Types.Assertion)
  details.assertions?.set('facebook:alice', {
    ...details.assertions?.get('facebook:alice'),
    state: 'valid',
  } as Tracker2Types.Assertion)
  details.assertions?.set('github:alice', {
    ...details.assertions?.get('github:alice'),
    state: 'valid',
  } as Tracker2Types.Assertion)
  details.assertions?.set('hackernews:alice', {
    ...details.assertions?.get('hackernews:alice'),
    state: 'valid',
  } as Tracker2Types.Assertion)
  details.assertions?.set('reddit:alice', {
    ...details.assertions?.get('reddit:alice'),
    state: 'valid',
  } as Tracker2Types.Assertion)
})

const ProfileCardWrapper = ({children}) => (
  <Kb.Box2
    direction="horizontal"
    gap="tiny"
    fullHeight={true}
    fullWidth={true}
    style={{
      backgroundColor: Styles.globalColors.blueGrey,
      padding: Styles.globalMargins.small,
    }}
  >
    {children}
  </Kb.Box2>
)

const Story = () => (
  <ProfileCardWrapper>
    <ProfileCard username={username} clickToProfile={true} showClose={true} />
  </ProfileCardWrapper>
)

const load = () => {
  // ---
  Sb.storiesOf('Common/ProfileCard', module)
    .addDecorator(
      Sb.updateStoreDecorator(commonValid, draftState => {
        draftState.config.username = username
      })
    )
    .add('ProfileCard – Is Self - No Follow button', Story)

  // ---
  Sb.storiesOf('Common/ProfileCard', module)
    .addDecorator(
      Sb.updateStoreDecorator(commonValid, draftState => {
        draftState.config.following.add(username)
      })
    )
    .add('ProfileCard – Follow them - No Follow Button', Story)

  // ---
  Sb.storiesOf('Common/ProfileCard', module)
    .addDecorator(
      Sb.updateStoreDecorator(commonBroken, draftState => {
        const details = Tracker2Constants.getDetails(draftState, username)
        details.bio = undefined
        details.assertions = new Map<string, Tracker2Types.Assertion>()
      })
    )
    .add('ProfileCard – Bio Missing - Proofs Missing', Story)

  // ---
  Sb.storiesOf('Common/ProfileCard', module)
    .addDecorator(
      Sb.updateStoreDecorator(commonBroken, draftState => {
        const details = Tracker2Constants.getDetails(draftState, username)
        details.assertions = new Map<string, Tracker2Types.Assertion>()
      })
    )
    .add('ProfileCard – Bio - Proofs Missing', Story)

  // ---
  Sb.storiesOf('Common/ProfileCard', module)
    .addDecorator(
      Sb.updateStoreDecorator(commonBroken, draftState => {
        const details = Tracker2Constants.getDetails(draftState, username)
        details.assertions?.delete('facebook:alice')
        details.assertions?.delete('reddit:alice')
        details.assertions?.delete('github:alice')
        details.assertions?.delete('hackernews:alice')
      })
    )
    .add('ProfileCard – Bio - Proofs - Broken - 1', Story)

  // ---
  Sb.storiesOf('Common/ProfileCard', module)
    .addDecorator(
      Sb.updateStoreDecorator(commonBroken, draftState => {
        const details = Tracker2Constants.getDetails(draftState, username)
        details.assertions?.delete('reddit:alice')
        details.assertions?.delete('hackernews:alice')
      })
    )
    .add('ProfileCard – Bio - Proofs - Broken - less than maxIcons', Story)

  // ---
  Sb.storiesOf('Common/ProfileCard', module)
    .addDecorator(Sb.updateStoreDecorator(commonBroken, _ => {}))
    .add('ProfileCard – Bio - Proofs - Broken - more than maxIcons', Story)

  // ---
  Sb.storiesOf('Common/ProfileCard', module)
    .addDecorator(
      Sb.updateStoreDecorator(commonValid, draftState => {
        const details = Tracker2Constants.getDetails(draftState, username)
        details.assertions?.delete('facebook:alice')
        details.assertions?.delete('reddit:alice')
        details.assertions?.delete('github:alice')
        details.assertions?.delete('hackernews:alice')
      })
    )
    .add('ProfileCard – Bio - Proofs - Valid - 1', Story)

  // ---
  Sb.storiesOf('Common/ProfileCard', module)
    .addDecorator(
      Sb.updateStoreDecorator(commonValid, draftState => {
        const details = Tracker2Constants.getDetails(draftState, username)
        details.assertions?.delete('reddit:alice')
        details.assertions?.delete('hackernews:alice')
      })
    )
    .add('ProfileCard – Bio - Proofs - Valid - less than maxIcons', Story)

  // ---
  Sb.storiesOf('Common/ProfileCard', module)
    .addDecorator(Sb.updateStoreDecorator(commonValid, _ => {}))
    .add('ProfileCard – Bio - Proofs - Valid - more than maxIcons', Story)
}
export default load
