// @flow
import * as I from 'immutable'
import React from 'react'
import * as Types from '../../constants/types/fs'
import * as Sb from '../../stories/storybook'
import Folder from '.'
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
  Sb.storiesOf('Files/Folder', module)
    .addDecorator(provider)
    .add('normal', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Folder
          path={Types.stringToPath('/keybase/private/foo')}
          routePath={I.List([])}
          shouldShowFileUIBanner={false}
          resetBannerType="none"
        />
      </Kb.Box2>
    ))
    .add('with FileUIBanner', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Folder
          path={Types.stringToPath('/keybase/private/foo')}
          routePath={I.List([])}
          shouldShowFileUIBanner={true}
          resetBannerType="none"
        />
      </Kb.Box2>
    ))
    .add('I am reset', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Folder
          path={Types.stringToPath('/keybase/private/me,reset')}
          routePath={I.List([])}
          shouldShowFileUIBanner={false}
          resetBannerType="self"
        />
      </Kb.Box2>
    ))
    .add('others reset', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Folder
          path={Types.stringToPath('/keybase/private/others,reset')}
          routePath={I.List([])}
          shouldShowFileUIBanner={false}
          resetBannerType={1}
        />
      </Kb.Box2>
    ))
}
