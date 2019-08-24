import React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Sb from '../../stories/storybook'
import {NormalPreview} from '../filepreview'
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
  ViewContainer: ({path}: {path: Types.Path}) => {
    const common = {
      lastModifiedTimestamp: 0,
      onLoadingStateChange: Sb.action('onLoadingStateChange'),
      path,
      type: Types.PathType.File,
      url: '',
    }
    if (Types.pathToString(path).endsWith('/loading')) {
      return common // no mimetype
    }
    if (Types.pathToString(path).endsWith('.txt')) {
      return {
        ...common,
        mime: Constants.makeMime({displayPreview: true, mimeType: 'text/plain'}),
        url: 'http://localhost:6006/sb_dll/storybook_ui_dll.js',
      }
    }
    if (Types.pathToString(path).endsWith('.jpg')) {
      return {
        ...common,
        mime: Constants.makeMime({displayPreview: true, mimeType: 'image/jpeg'}),
        url: Types.pathToString(path).endsWith('small.jpg')
          ? 'https://keybase.io/images/icons/icon-keybase-logo-48@2x.png'
          : 'https://keybase.io/images/blog/teams/teams-splash-announcement.png',
      }
    }
    if (Types.pathToString(path).endsWith('.mp4')) {
      return {
        ...common,
        mimeType: Constants.makeMime({displayPreview: true, mimeType: 'video/mp4'}),
        url:
          'https://archive.org/download/youtube%2DA0FZIwabctw/Falcon%5FHeavy%5FStarman%2DA0FZIwabctw%2Emp4',
      }
    }
    return {
      ...common,
      mimeType: Constants.makeMime({mimeType: 'application/pdf'}),
    }
  },
}

const provider = Sb.createPropProviderWithCommon({
  ...commonProvider,
  ...footerProvider,
  ...bannerProvider,
  ...filepreviewProvider,
})

const filenames = [
  'loading',
  'small.jpg',
  'large.jpg',
  'text.txt',
  'video.mp4',
  'default.default',
  'default-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name.default',
]

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
