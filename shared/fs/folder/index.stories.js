// @flow
import * as I from 'immutable'
import React from 'react'
import * as Types from '../../constants/types/fs'
import * as Sb from '../../stories/storybook'
import Folder from '.'
import * as Kb from '../../common-adapters'
import {rowsProvider} from '../row/index.stories'
import {commonProvider} from '../common/index.stories'
import {topBarProvider} from '../top-bar/index.stories'
import {footerProvider} from '../footer/index.stories'
import {bannerProvider} from '../banner/index.stories'
import {headerProvider} from '../header/index.stories'

const provider = Sb.createPropProviderWithCommon({
  ...rowsProvider,
  ...commonProvider,
  ...topBarProvider,
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
          shouldShowSFMIBanner={false}
          resetBannerType="none"
          offline={false}
        />
      </Kb.Box2>
    ))
    .add('with SystemFileManagerIntegrationBanner', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Folder
          path={Types.stringToPath('/keybase/private/foo')}
          routePath={I.List([])}
          shouldShowSFMIBanner={true}
          resetBannerType="none"
          offline={false}
        />
      </Kb.Box2>
    ))
    .add('I am reset', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Folder
          path={Types.stringToPath('/keybase/private/me,reset')}
          routePath={I.List([])}
          shouldShowSFMIBanner={false}
          resetBannerType="self"
          offline={false}
        />
      </Kb.Box2>
    ))
    .add('others reset', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Folder
          path={Types.stringToPath('/keybase/private/others,reset')}
          routePath={I.List([])}
          shouldShowSFMIBanner={false}
          resetBannerType={1}
          offline={false}
        />
      </Kb.Box2>
    ))
    .add('offline and not synced', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Folder
          path={Types.stringToPath('/keybase/private/others,reset')}
          routePath={I.List([])}
          shouldShowSFMIBanner={false}
          resetBannerType="none"
          offline={true}
        />
      </Kb.Box2>
    ))
}
