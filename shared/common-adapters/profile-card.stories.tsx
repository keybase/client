import * as React from 'react'
import * as Sb from '../stories/storybook'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import ProfileCard from './profile-card'

export const provider = Sb.createPropProviderWithCommon({})

const load = () => {
  Sb.storiesOf('Profile/Card', module)
    .addDecorator(provider)
    .add('Basic', () => (
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
        <ProfileCard username="t_alice" clickToProfile={true} showClose={true} />
      </Kb.Box2>
    ))
}
export default load
