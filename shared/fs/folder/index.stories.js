// @flow
import * as I from 'immutable'
import React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Sb from '../../stories/storybook'
import Files from '.'
import * as Kb from '../../common-adapters'
import {rowsProvider} from '../row/index.stories'
import {commonProvider} from '../common/index.stories'
import {footerProvider} from '../footer/index.stories'
import {bannerProvider} from '../banner/index.stories'
import {headerProvider} from '../header/index.stories'

const provider = Sb.createPropProviderWithCommon({
  ...rowsProvider,
  ...commonProvider,
  ...footerProvider,
  ...bannerProvider,
  ...headerProvider,
})

export default () => {
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .add('Root', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Files
          path={Types.stringToPath('/keybase')}
          routePath={I.List([])}
          isUserReset={false}
          resetParticipants={['foo']}
          sortSetting={Constants.makeSortSetting()}
        />
      </Kb.Box2>
    ))
}
