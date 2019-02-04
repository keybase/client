// @flow
import React from 'react'
import * as Sb from '../../stories/storybook'
import * as Types from '../../constants/types/fs'
import OopsNoAccess from '.'
import {commonProvider} from '../common/index.stories'

export const provider = Sb.createPropProviderWithCommon({...commonProvider})

const common = {onCancel: Sb.action('onCancel')}

const load = () =>
  Sb.storiesOf('Files/Oops', module)
    .addDecorator(provider)
    .add('no-access team', () => (
      <OopsNoAccess {...common} path={Types.stringToPath('/keybase/team/kbkbfstest')} reason="no-access" />
    ))
    .add('no-access private', () => (
      <OopsNoAccess {...common} path={Types.stringToPath('/keybase/private/foo,bar')} reason="no-access" />
    ))
    .add('non-existent', () => (
      <OopsNoAccess
        {...common}
        path={Types.stringToPath('/keybase/team/kbkbfstest/non-existent')}
        reason="non-existent"
      />
    ))

export default load
