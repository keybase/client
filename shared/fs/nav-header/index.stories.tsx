import React from 'react'
import {isMobile} from '../../constants/platform'
import * as Types from '../../constants/types/fs'
import * as Sb from '../../stories/storybook'
import {commonProvider} from '../common/index.stories'
import Nav2Header from '../../router-v2/header'
import MobileHeader from './mobile-header'
import {MainBanner} from '.'
import FilesContainer from '../container'

export const headerProvider = {
  FsNavHeaderRightActions: p => ({
    ...p,
    hasSoftError: false,
  }),
  MainBanner: (p: any) => ({
    // Auto generated from flowToTs. Please clean me!
    bannerType: (p.storyProps && p.storyProps.bannerType) || Types.MainBannerType.None,
    onRetry: Sb.action('onRetry'),
  }),
  NavHeaderMobile: ({onBack, path}: {onBack: () => void; path: Types.Path}) => ({
    onBack,
    path,
  }),
  NavHeaderTitle: ({path}: {path: Types.Path}) => ({
    onOpenPath: Sb.action('onOpenPath'),
    path,
  }),
}

const provider = Sb.createPropProviderWithCommon({
  ...commonProvider,
  ...headerProvider,
})

const TestWrapper = ({path}: {path: Types.Path}) =>
  isMobile ? (
    <MobileHeader path={path} onBack={Sb.action('onBack')} />
  ) : (
    <Nav2Header
      allowBack={true}
      loggedIn={true}
      onPop={Sb.action('onPop')}
      options={FilesContainer.navigationOptions({
        navigation: {getParam: key => (key === 'path' ? path : null)},
      } as any)}
    />
  )

const addStories = story =>
  [
    '/keybase',
    '/keybase/team',
    '/keybase/team/kbkbfstest',
    '/keybase/team/kbkbfstest/folder',
    '/keybase/team/kbkbfstest/folder/pic.jpg',
    '/keybase/team/kbkbfstest/folder/JDGHJ-FGHJEWK-DHSDGHD-DOPQBNZFHBQKLJKE-DSG32DB17D.20190103-143400.jpg',
  ].forEach(pathStr => story.add(pathStr, () => <TestWrapper path={Types.stringToPath(pathStr)} />))

export default () => {
  addStories(Sb.storiesOf('Files/NavHeaders', module).addDecorator(provider))

  Sb.storiesOf('Files/Banners', module)
    .addDecorator(provider)
    .add('Out of space', () => (
      <MainBanner {...Sb.propOverridesForStory({bannerType: Types.MainBannerType.OutOfSpace})} />
    ))
    .add('Offline', () => (
      <MainBanner {...Sb.propOverridesForStory({bannerType: Types.MainBannerType.Offline})} />
    ))
}
