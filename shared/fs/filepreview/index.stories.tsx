import React from 'react'
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
    pathItem: {
      ...Constants.emptyFile,
      lastWriter: 'foo',
      name: 'bar.jpg',
      size: 10240,
    },
    sfmiEnabled: false,
  }),
  FilePreviewHeader: ({path}: {path: Types.Path}) => ({
    loadPathMetadata: () => {},
    name: Types.getPathName(path),
    onAction: () => {},
    onBack: () => {},
    onShowInSystemFileManager: () => {},
    path,
    pathItem: {
      ...Constants.emptyFile,
      lastWriter: 'foo',
      name: 'bar.jpg',
      size: 10240,
    },
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
  fs: {
    ...storeCommon.fs,
    fileContext: new Map([
      [
        '/keybase/private/foo/small.jpg',
        {
          ...Constants.emptyFileContext,
          contentType: 'image/jpeg',
          url: 'https://keybase.io/images/icons/icon-keybase-logo-48@2x.png',
          viewType: RPCTypes.GUIViewType.image,
        },
      ],
      [
        '/keybase/private/foo/large.jpg',
        {
          ...Constants.emptyFileContext,
          contentType: 'image/jpeg',
          url: 'https://keybase.io/images/blog/teams/teams-splash-announcement.png',
          viewType: RPCTypes.GUIViewType.image,
        },
      ],
      [
        '/keybase/private/foo/text.txt',
        {
          ...Constants.emptyFileContext,
          contentType: 'text/plain; charset=utf-8',
          url: 'https://keybase.io/images/blog/teams/teams-splash-announcement.png',
          viewType: RPCTypes.GUIViewType.image,
        },
      ],
      [
        '/keybase/private/foo/video.mp4',
        {
          ...Constants.emptyFileContext,
          contentType: 'text/plain; charset=utf-8',
          url:
            'https://archive.org/download/youtube%2DA0FZIwabctw/Falcon%5FHeavy%5FStarman%2DA0FZIwabctw%2Emp4',
          viewType: RPCTypes.GUIViewType.video,
        },
      ],
      [
        '/keybase/private/foo/default-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name.default',
        {
          ...Constants.emptyFileContext,
          contentType: 'text/plain; charset=utf-8',
          viewType: RPCTypes.GUIViewType.default,
        },
      ],
      [
        '/keybase/private/foo/default.default',
        {
          ...Constants.emptyFileContext,
          contentType: 'text/plain; charset=utf-8',
          viewType: RPCTypes.GUIViewType.default,
        },
      ],
    ]),
    pathItems: new Map<Types.Path, Types.PathItem>([
      [Types.stringToPath('/keybase/private/foo/loading'), Constants.emptyFile],
      ...filenames
        .filter(n => n !== 'loading')
        .map(
          name =>
            [
              Types.stringToPath(`/keybase/private/foo/${name}`),
              {
                ...Constants.emptyFile,
                ...fileCommon,
                name,
              },
            ] as const
        ),
    ]),
  },
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
        <NormalPreview path={Types.stringToPath(`/keybase/private/foo/${fn}`)} onUrlError={() => {}} />
      </Kb.Box2>
    ))
  )
}
