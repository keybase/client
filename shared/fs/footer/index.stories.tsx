import React from 'react'
import * as I from 'immutable'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/fs'
import Downloads from './downloads'
import Upload from './upload'

export const footerProvider = {
  ConnectedUpload: () => ({
    files: 0,
  }),
}

const provider = Sb.createPropProviderWithCommon(footerProvider)

const storeCommon = Sb.createStoreWithCommon()
const store = {
  ...storeCommon,
  fs: {
    ...storeCommon.fs,
    downloads: Constants.makeDownloads({
      info: I.Map([
        [
          'id0',
          Constants.makeDownloadInfo({
            filename: 'file 1',
            isRegularDownload: true,
            path: '/keybase/team/kbkbfstest/file 1',
            startTime: 0,
          }),
        ],
        [
          'id1',
          Constants.makeDownloadInfo({
            filename: 'file 2',
            isRegularDownload: true,
            path: '/keybase/team/kbkbfstest/file 2',
            startTime: 1,
          }),
        ],
        [
          'id2',
          Constants.makeDownloadInfo({
            filename: 'fijweopfjewoajfaeowfjoaweijf',
            isRegularDownload: true,
            path: '/keybase/team/kbkbfstest/fijweopfjewoajfaeowfjoaweijf',
            startTime: 2,
          }),
        ],
        [
          'id3',
          Constants.makeDownloadInfo({
            filename: 'aaa',
            isRegularDownload: true,
            path: '/keybase/team/kbkbfstest/aaa',
            startTime: 3,
          }),
        ],
      ]),
      regularDownloads: I.List(['id3', 'id2', 'id1', 'id0']),
      state: I.Map([
        [
          'id0',
          Constants.makeDownloadState({
            progress: 0.5,
          }),
        ],
        [
          'id1',
          Constants.makeDownloadState({
            canceled: true,
          }),
        ],
        [
          'id2',
          Constants.makeDownloadState({
            error: 'this is an error',
          }),
        ],
        [
          'id3',
          Constants.makeDownloadState({
            done: true,
          }),
        ],
      ]),
    }),
  },
}

const load = () =>
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Downloads', () => <Downloads />)
    .add('UploadBanner', () => (
      <Upload fileName={null} files={42} totalSyncingBytes={100} timeLeft="23 min" showing={true} />
    ))

export default load
