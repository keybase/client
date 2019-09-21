import React from 'react'
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Sb from '../../stories/storybook'
import {NormalPreview} from '.'
import * as Kb from '../../common-adapters'
import {commonProvider} from '../common/index.stories'
import {footerProvider} from '../footer/index.stories'
import {bannerProvider} from '../banner/index.stories'

export const filepreviewProvider = {
  FilePreviewDefaultView: () => ({
    onDownload: () => {},
    onSave: () => {},
    onShare: () => {},
    onShowInSystemFileManager: () => {},
    pathItem: Constants.makeFile({
      lastWriter: 'foo',
      name: 'bar.jpg',
      size: 10240,
    }),
    sfmiEnabled: false,
  }),
  FilePreviewHeader: ({path}: {path: Types.Path}) => ({
    loadPathMetadata: () => {},
    name: Types.getPathName(path),
    onAction: () => {},
    onBack: () => {},
    onShowInSystemFileManager: () => {},
    path,
    pathItem: Constants.makeFile({
      lastWriter: 'foo',
      name: 'bar.jpg',
      size: 10240,
    }),
  }),
}

const filenames = [
  'loading',
  'small.jpg',
  'large.jpg',
  'text.txt',
  'video.mp4',
  'default.default',
  'default-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name.default',
]

const fileCommon = {lastWriter: 'foo', writable: true}

const storeCommon = Sb.createStoreWithCommon()
const store = {
  ...storeCommon,
  fs: storeCommon.fs
    .set(
      'fileContext',
      I.Map([
        [
          '/keybase/private/foo/small.jpg',
          Constants.makeFileContext({
            contentType: 'image/jpeg',
            url: 'https://keybase.io/images/icons/icon-keybase-logo-48@2x.png',
            viewType: RPCTypes.GUIViewType.image,
          }),
        ],
        [
          '/keybase/private/foo/large.jpg',
          Constants.makeFileContext({
            contentType: 'image/jpeg',
            url: 'https://keybase.io/images/blog/teams/teams-splash-announcement.png',
            viewType: RPCTypes.GUIViewType.image,
          }),
        ],
        [
          '/keybase/private/foo/text.txt',
          Constants.makeFileContext({
            contentType: 'text/plain; charset=utf-8',
            url: 'https://keybase.io/images/blog/teams/teams-splash-announcement.png',
            viewType: RPCTypes.GUIViewType.image,
          }),
        ],
        [
          '/keybase/private/foo/video.mp4',
          Constants.makeFileContext({
            contentType: 'text/plain; charset=utf-8',
            url:
              'https://archive.org/download/youtube%2DA0FZIwabctw/Falcon%5FHeavy%5FStarman%2DA0FZIwabctw%2Emp4',
            viewType: RPCTypes.GUIViewType.video,
          }),
        ],
        [
          '/keybase/private/foo/default-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name.default',
          Constants.makeFileContext({
            contentType: 'text/plain; charset=utf-8',
            viewType: RPCTypes.GUIViewType.default,
          }),
        ],
        [
          '/keybase/private/foo/default.default',
          Constants.makeFileContext({
            contentType: 'text/plain; charset=utf-8',
            viewType: RPCTypes.GUIViewType.default,
          }),
        ],
      ])
    )
    .set(
      'pathItems',
      // @ts-ignore
      I.Map([
        ['/keybase/private/foo/loading', Constants.makeFile()],
        ...filenames
          .filter(n => n !== 'loading')
          .map(name => [`/keybase/private/foo/${name}`, Constants.makeFile({...fileCommon, name})]),
      ])
    ),
}

// @ts-ignore
const provider = Sb.createPropProviderWithCommon({
  ...commonProvider,
  ...footerProvider,
  ...bannerProvider,
  ...filepreviewProvider,
  ...store,
})

export default () => {
  const s = Sb.storiesOf('Files/Previews', module).addDecorator(provider)
  filenames.forEach(fn =>
    s.add(fn, () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <NormalPreview path={Types.stringToPath(`/keybase/private/foo/${fn}`)} />
      </Kb.Box2>
    ))
  )
}
