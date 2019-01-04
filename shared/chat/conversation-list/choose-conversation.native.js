// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import type {Props} from './choose-conversation'

export default (props: Props) => (
  <Kb.Box2 direction="horizontal" centerChildren={true} style={{padding: 32}}>
    <Kb.Text type="BodySmallError">
      choose-conversation is not supported on mobile. If you see this outside storybook something is wrong.
    </Kb.Text>
  </Kb.Box2>
)
