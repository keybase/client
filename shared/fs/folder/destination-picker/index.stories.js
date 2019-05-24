// @flow
import * as I from 'immutable'
import React from 'react'
import * as Sb from '../../../stories/storybook'
import * as Types from '../../../constants/types/fs'
import DestinationPicker from '.'
import {rowsProvider} from '../../folder/rows/index.stories'
import {commonProvider} from '../../common/index.stories'
import {topBarProvider} from '../../top-bar/index.stories'
import {isMobile} from '../../../constants/platform'

export const provider = Sb.createPropProviderWithCommon({
  ...commonProvider,
  ...rowsProvider,
  ...topBarProvider,
  NavHeaderTitle: ({path}: {path: Types.Path}) => ({
    onOpenPath: Sb.action('onOpenPath'),
    path,
  }),
})

const load = () =>
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .add('DestinationPicker', () => (
      <DestinationPicker
        parentPath={Types.stringToPath('/keybase/private/meatball,songgao,xinyuzhao/yo')}
        routePath={I.List([])}
        onCancel={Sb.action('onCancel')}
        targetName="Secret treat spot blasjeiofjawiefjksadjflaj long name blahblah"
        index={0}
        onCopyHere={Sb.action('onCopyHere')}
        onMoveHere={Sb.action('onMoveHere')}
        onNewFolder={Sb.action('onNewFolder')}
        onBackUp={isMobile ? Sb.action('onBackUp') : null}
      />
    ))

export default load
