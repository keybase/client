// @flow
import React from 'react'
import * as Sb from '../../stories/storybook'
import * as Types from '../../constants/types/fs'
import OopsNoAccess from '.'
import {commonProvider} from '../common/index.stories'

export const provider = Sb.createPropProviderWithCommon({...commonProvider})

const common = {onCancel: Sb.action('onCancel')}

const load = () =>
  Sb.storiesOf('Files/OopsNoAccess', module)
    .addDecorator(provider)
    .add('team', () => <OopsNoAccess {...common} path={Types.stringToPath('/keybase/team/kbkbfstest')} />)
    .add('private', () => <OopsNoAccess {...common} path={Types.stringToPath('/keybase/private/foo,bar')} />)

export default load
