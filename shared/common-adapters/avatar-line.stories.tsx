import React from 'react'
import * as Sb from '../stories/storybook'
import * as Kb from '.'
import AvatarLine from './avatar-line'
const load = () => {
  Sb.storiesOf('Common', module).add('AvatarLine', () => (
    <Kb.Box2 direction="vertical" gap="medium" fullWidth={true} alignItems="center">
      <Kb.Box2 direction="vertical" gap="small" fullWidth={true} alignItems="center">
        <AvatarLine usernames={['jakob223', 'max', 'ayoubd']} layout="horizontal" maxShown={4} size={64} />
        <AvatarLine
          usernames={['jakob223', 'max', 'ayoubd', 'chris', 'joshblum', 'marcopolo']}
          layout="horizontal"
          maxShown={4}
          size={64}
        />
        <AvatarLine
          usernames={['jakob223', 'max', 'ayoubd', 'chris', 'joshblum', 'marcopolo']}
          layout="horizontal"
          maxShown={4}
          size={48}
        />
        <AvatarLine
          usernames={['jakob223', 'max', 'ayoubd', 'chris', 'joshblum', 'marcopolo']}
          layout="horizontal"
          maxShown={4}
          size={32}
        />
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" gap="small" fullWidth={true} alignItems="center">
        <AvatarLine usernames={['jakob223', 'max', 'ayoubd']} layout="vertical" maxShown={4} size={64} />
        <AvatarLine
          usernames={['jakob223', 'max', 'ayoubd', 'chris', 'joshblum', 'marcopolo']}
          layout="vertical"
          maxShown={4}
          size={64}
        />
        <AvatarLine
          usernames={['jakob223', 'max', 'ayoubd', 'chris', 'joshblum', 'marcopolo']}
          layout="vertical"
          maxShown={4}
          size={48}
        />
        <AvatarLine
          usernames={['jakob223', 'max', 'ayoubd', 'chris', 'joshblum', 'marcopolo']}
          layout="vertical"
          maxShown={4}
          size={32}
        />
      </Kb.Box2>
    </Kb.Box2>
  ))
}

export default load
