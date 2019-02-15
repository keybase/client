// @flow
import * as I from 'immutable'
import React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Sb from '../../stories/storybook'
import {NormalPreview} from '../filepreview'
import * as Kb from '../../common-adapters'
import {commonProvider} from '../common/index.stories'
import {footerProvider} from '../footer/index.stories'
import {bannerProvider} from '../banner/index.stories'
import {headerProvider} from '../header/index.stories'

export const filepreviewProvider = {
  FilePreviewDefaultView: () => ({
    fileUIEnabled: false,
    onDownload: () => {},
    onSave: () => {},
    onShare: () => {},
    onShowInSystemFileManager: () => {},
    pathItem: Constants.makeFile({
      lastWriter: {uid: '', username: 'foo'},
      name: 'bar.jpg',
      size: 10240,
    }),
  }),
  FilePreviewHeader: ({path}: {path: Types.Path}) => ({
    loadFilePreview: () => {},
    name: Types.getPathName(path),
    onAction: () => {},
    onBack: () => {},
    onShowInSystemFileManager: () => {},
    path,
    pathItem: Constants.makeFile({
      lastWriter: {uid: '', username: 'foo'},
      name: 'bar.jpg',
      size: 10240,
    }),
  }),
  ViewContainer: () => ({
    isSymlink: false,
    loadMimeType: Sb.action('loadMimeType'),
    mimeType: Constants.makeMime({mimeType: 'image/jpeg'}),
    onInvalidToken: Sb.action('onInvalidToken'),
    path: '/keybase/private/foo/bar.jpg',
    url: '/keybase/private/foo/bar.jpg',
  }),
}

const provider = Sb.createPropProviderWithCommon({
  ...commonProvider,
  ...footerProvider,
  ...bannerProvider,
  ...headerProvider,
  ...filepreviewProvider,
})

export default () => {
  Sb.storiesOf('Files/Previews', module)
    .addDecorator(provider)
    .add('bar.jpg', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <NormalPreview routePath={I.List([])} path={Types.stringToPath('/keybase/private/foo/bar.jpg')} />
      </Kb.Box2>
    ))
    .add('long-name.jpg', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <NormalPreview
          routePath={I.List([])}
          path={Types.stringToPath(
            '/keybase/private/foo/long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name-long-name.jpg'
          )}
        />
      </Kb.Box2>
    ))
}
