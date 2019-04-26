// @flow
import React from 'react'
import * as Sb from '../../stories/storybook'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import OopsNoAccess from '.'
import {commonProvider} from '../common/index.stories'

export const provider = Sb.createPropProviderWithCommon({...commonProvider})

const load = () =>
  Sb.storiesOf('Files/Oops', module)
    .addDecorator(provider)
    .add('no-access team', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <OopsNoAccess path={Types.stringToPath('/keybase/team/kbkbfstest')} reason="no-access" />
      </Kb.Box2>
    ))
    .add('no-access private', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <OopsNoAccess path={Types.stringToPath('/keybase/private/foo,bar')} reason="no-access" />
      </Kb.Box2>
    ))
    .add('non-existent', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <OopsNoAccess
          path={Types.stringToPath('/keybase/team/kbkbfstest/non-existent')}
          reason="non-existent"
        />
      </Kb.Box2>
    ))

export default load
