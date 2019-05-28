// @flow
import React from 'react'
import * as Sb from '../../stories/storybook'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import Oops from './oops'
import Loading from './loading'
import {commonProvider} from '../common/index.stories'

export const provider = Sb.createPropProviderWithCommon({...commonProvider})

const load = () => {
  Sb.storiesOf('Files/SimpleScreens/Oops', module)
    .addDecorator(provider)
    .add('no-access team', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Oops path={Types.stringToPath('/keybase/team/kbkbfstest')} reason="no-access" />
      </Kb.Box2>
    ))
    .add('no-access private', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Oops path={Types.stringToPath('/keybase/private/foo,bar')} reason="no-access" />
      </Kb.Box2>
    ))
    .add('non-existent', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Oops path={Types.stringToPath('/keybase/team/kbkbfstest/non-existent')} reason="non-existent" />
      </Kb.Box2>
    ))
  Sb.storiesOf('Files/SimpleScreens', module).add('Loading', () => (
    <Loading path={Types.stringToPath('/keybase/team/kbkbfstest')} />
  ))
}

export default load
