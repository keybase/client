// @flow
import React from 'react'
import * as Sb from '../../stories/storybook'
import {Box, Box2, Text} from '../../common-adapters'
import Downloads from './downloads'
import Download from './download'
import Upload from './upload'

export const footerProvider = {
  ConnectedDownload: ({downloadKey}: {downloadKey: string}) => ({
    cancel: Sb.action('cancel'),
    completePortion: downloadKey.split('').reduce((num, char) => (num + char.charCodeAt(0)) % 100, 0) / 100,
    dismiss: Sb.action('dismiss'),
    filename: downloadKey,
    isDone: false,
    open: Sb.action('open'),
    progressText: '42 s',
  }),
  ConnectedDownloads: () => ({
    downloadKeys: ['file 1', 'blah 2', 'yo 3'],
    openDownloadFolder: Sb.action('openDownloadFolder'),
    thereAreMore: true,
  }),
  ConnectedUpload: () => ({
    files: 0,
  }),
}

const provider = Sb.createPropProvider(footerProvider)

const load = () =>
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Downloads', () => (
      <Box2 direction="vertical">
        <Text type="Header">1 item</Text>
        <Downloads
          downloadKeys={['file 1']}
          thereAreMore={false}
          openDownloadFolder={Sb.action('openDownloadFolder')}
        />
        <Text type="Header">2 items</Text>
        <Downloads
          downloadKeys={['file 1', 'blah 2']}
          thereAreMore={false}
          openDownloadFolder={Sb.action('openDownloadFolder')}
        />
        <Text type="Header">3 items</Text>
        <Downloads
          downloadKeys={['file 1', 'blah 2', 'yo 3']}
          thereAreMore={false}
          openDownloadFolder={Sb.action('openDownloadFolder')}
        />
        <Text type="Header">4+ items</Text>
        <Downloads
          downloadKeys={['file 1', 'blah 2', 'yo 3']}
          thereAreMore={true}
          openDownloadFolder={Sb.action('openDownloadFolder')}
        />
      </Box2>
    ))
    .add('Download Cards', () => (
      <Box>
        <Box style={{height: 8}} />
        <Download
          filename="fjweio"
          completePortion={0.42}
          progressText="4 s"
          isDone={false}
          {...downloadCommonActions}
        />
        <Box style={{height: 8}} />
        <Download
          filename="fjweio afiojwe fweiojf oweijfweoi fjwoeifj ewoijf oew"
          completePortion={0.42}
          progressText="4 s"
          isDone={false}
          {...downloadCommonActions}
        />
        <Box style={{height: 8}} />
        <Download
          filename="fjweioafiojwefweiojfoweijfweoifjwoeifjewoijfoew"
          completePortion={0.42}
          progressText="4 s"
          isDone={false}
          {...downloadCommonActions}
        />
        <Box style={{height: 8}} />
        <Download
          filename="fjweioafiojwefweiojfoweijfweoifjwoeifjewoijfoew"
          completePortion={0.42}
          progressText="59 min"
          isDone={false}
          {...downloadCommonActions}
        />
        <Box style={{height: 8}} />
        <Download
          filename="fjweioafiojwefweiojfoweijfweoifjwoeifjewoijfoew"
          completePortion={0.42}
          progressText="1234 hr"
          isDone={false}
          {...downloadCommonActions}
        />
        <Box style={{height: 8}} />
      </Box>
    ))
    .add('UploadBanner', () => (
      <Upload fileName={null} files={42} totalSyncingBytes={100} timeLeft="23 min" showing={true} />
    ))

const downloadCommonActions = {
  cancel: Sb.action('cancel'),
  dismiss: Sb.action('dismiss'),
  open: Sb.action('open'),
}

export default load
