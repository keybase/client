// @flow
import * as I from 'immutable'
import React from 'react'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import DestinationPicker from '.'
import {makeBreadcrumbProps} from '../header/breadcrumb-container.desktop'
import {rowsProvider} from '../row/index.stories'
import {commonProvider} from '../common/index.stories'

import {isMobile} from '../../constants/platform'

export const provider = Sb.createPropProviderWithCommon({
  ...commonProvider,
  ...rowsProvider,
  ConnectedBreadcrumb: ({path}) =>
    makeBreadcrumbProps('meatball', path => Sb.action(`navigate to ${Types.pathToString(path)}`)(), path),
})

const load = () =>
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .add('DestinationPicker', () => (
      <DestinationPicker
        path={Types.stringToPath('/keybase/private/meatball,songgao,xinyuzhao/yo')}
        routePath={I.List([])}
        onCancel={Sb.action('onCancel')}
        targetName="Secret treat spot blasjeiofjawiefjksadjflaj"
        targetIconSpec={
          Constants.getItemStyles(['keybase', 'private', 'meatball', 'Secret treat spot'], 'folder').iconSpec
        }
        index={0}
        onCopyHere={Sb.action('onCopyHere')}
        onMoveHere={Sb.action('onMoveHere')}
        onNewFolder={Sb.action('onNewFolder')}
        onBackUp={isMobile ? Sb.action('onBackUp') : null}
      />
    ))

export default load
