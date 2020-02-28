import Avatar, {AvatarSize} from '.'
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import * as Constants from '../../constants/tracker2'
import Text from '../text'
import Box, {Box2} from '../box'

const Kb = {
  Avatar,
  Box,
  Box2,
  Text,
}

const sizes: Array<AvatarSize> = [128, 96, 64, 48, 32, 16]
const provider = Sb.createPropProviderWithCommon(
  Sb.PropProviders.Avatar(['following', 'both'], ['followers', 'both'])
)

const store = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.tracker2.usernameToDetails.set('t_bob', {
    assertions: new Map([
      [
        'one',
        {
          ...Constants.noAssertion,
          type: 'twitter',
          value: 'alice',
          state: 'checking',
        },
      ],
    ]),
  })
  draftState.tracker2.usernameToDetails.set('t_carol', {
    assertions: new Map([
      [
        'one',
        {
          ...Constants.noAssertion,
          type: 'twitter',
          value: 'alice',
          state: 'checking',
        },
      ],
      [
        'two',
        {
          ...Constants.noAssertion,
          type: 'facebook',
          value: 'alice',
          state: 'valid',
        },
      ],
    ]),
  })
  draftState.tracker2.usernameToDetails.set('t_bad', {
    assertions: new Map([
      [
        'one',
        {
          ...Constants.noAssertion,
          type: 'twitter',
          value: 'alice',
          state: 'checking',
        },
      ],
      [
        'two',
        {
          ...Constants.noAssertion,
          type: 'facebook',
          value: 'alice',
          state: 'error',
        },
      ],
    ]),
  })
})

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(provider)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Avatar', () =>
      sizes.map(size => {
        const commonProps = {
          onClick: Sb.action('Avatar clicked'),
          showFollowingStatus: false,
          size: size,
          username: 'nofollow-following',
        }
        return (
          <Kb.Box key={size}>
            <Kb.Text type="Body">{size}</Kb.Text>
            <Kb.Box2 direction="horizontal" gap="small" style={{flexWrap: 'wrap'}}>
              <Kb.Avatar {...commonProps} />
              <Kb.Avatar {...commonProps} borderColor="blue" />
              <Kb.Avatar {...commonProps} username="following" />
              <Kb.Avatar {...commonProps} username="followers" />
              <Kb.Avatar {...commonProps} username="both" />
              <Kb.Avatar {...commonProps} username={undefined} teamname="keybase" />
            </Kb.Box2>
          </Kb.Box>
        )
      })
    )

  Sb.storiesOf('Common', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('AvatarFollow', () => {
      const props = {
        onClick: Sb.action('Avatar clicked'),
        showFollowingStatus: true,
        size: 128,
      } as const
      return (
        <Kb.Box2 direction="vertical" fullWidth={true} gap="small" gapStart={true} style={{margin: 28}}>
          <Kb.Avatar {...props} username="t_alice" />
          <Kb.Box2 alignSelf="flex-start" direction="vertical" style={{padding: 50, position: 'relative'}}>
            <Kb.Box2
              direction="vertical"
              style={{
                backgroundColor: Styles.globalColors.red,
                height: '50%',
                position: 'absolute',
                top: 0,
                width: '100%',
              }}
            />
            <Kb.Avatar {...props} username="t_alice" />
          </Kb.Box2>
          <Kb.Avatar {...props} username="t_bob" size={64} />
        </Kb.Box2>
      )
    })
}

export default load
