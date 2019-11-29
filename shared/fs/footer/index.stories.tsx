import React from 'react'
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
    downloads: {
      info: new Map([
        [
          'id0',
          {
            ...Constants.emptyDownloadInfo,
            filename: 'file 1',
            isRegularDownload: true,
            path: '/keybase/team/kbkbfstest/file 1',
            startTime: 0,
          },
        ],
        [
          'id1',
          {
            ...Constants.emptyDownloadInfo,
            filename: 'file 2',
            isRegularDownload: true,
            path: '/keybase/team/kbkbfstest/file 2',
            startTime: 1,
          },
        ],
        [
          'id2',
          {
            ...Constants.emptyDownloadInfo,
            filename: 'fijweopfjewoajfaeowfjoaweijf',
            isRegularDownload: true,
            path: '/keybase/team/kbkbfstest/fijweopfjewoajfaeowfjoaweijf',
            startTime: 2,
          },
        ],
        [
          'id3',
          {
            ...Constants.emptyDownloadInfo,
            filename: 'aaa',
            isRegularDownload: true,
            path: '/keybase/team/kbkbfstest/aaa',
            startTime: 3,
          },
        ],
      ]),
      regularDownloads: ['id3', 'id2', 'id1', 'id0'],
      state: new Map([
        [
          'id0',
          {
            ...Constants.emptyDownloadState,
            progress: 0.5,
          },
        ],
        [
          'id1',
          {
            ...Constants.emptyDownloadState,
            canceled: true,
          },
        ],
        [
          'id2',
          {
            ...Constants.emptyDownloadState,
            error: 'this is an error',
          },
        ],
        [
          'id3',
          {
            ...Constants.emptyDownloadState,
            done: true,
          },
        ],
      ]),
    },
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
