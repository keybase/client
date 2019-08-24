import * as React from 'react'
import {Box} from '../../../../../../common-adapters/index'
import * as Sb from '../../../../../../stories/storybook'

import UnfurlGeneric from '.'

const full = {
  description:
    'A surge in technology shares following Facebook’s latest earnings lifted U.S. stocks, helping major indexes trim some of their October declines following a punishing period for global investors.',
  faviconURL: require('../../../../../../images/mock/wsj.jpg'),
  imageHeight: 471,
  imageURL: require('../../../../../../images/mock/wsj_image.jpg'),
  imageWidth: 900,
  isCollapsed: false,
  onClose: Sb.action('onClose'),
  onCollapse: Sb.action('onCollapse'),
  publishTime: 1542241021655,
  showImageOnSide: false,
  siteName: 'WSJ',
  title: 'U.S. Stocks Jump as Tough Month Sets to Wrap',
  url: 'https://www.wsj.com/articles/global-stocks-rally-to-end-a-tough-month-1540976261',
}

const noClose = {
  ...full,
  onClose: undefined,
}

const missingPub = {
  ...full,
  publishTime: undefined,
}

const missingPubDesc = {
  ...missingPub,
  description: undefined,
}

const missingPubDescImage = {
  ...missingPubDesc,
  imageURL: undefined,
}

const missingPubDescImageFav = {
  ...missingPubDescImage,
  faviconURL: undefined,
}

const missingImage = {
  ...full,
  imageURL: undefined,
}

const fullGithub = {
  description: 'Keybase Go Library, Client, Service, OS X, iOS, Android, Electron - keybase/client',
  faviconURL: require('../../../../../../images/mock/github_fav.jpg'),
  imageURL: require('../../../../../../images/mock/github.jpg'),
  isCollapsed: false,
  onClose: Sb.action('onClose'),
  onCollapse: Sb.action('onCollapse'),
  showImageOnSide: true,
  siteName: 'GitHub',
  title: 'keybase/client',
  url: 'https://github.com/keybase/client"',
}

const githubMissingDesc = {
  ...fullGithub,
  description: undefined,
}

const githubMissingImage = {
  ...fullGithub,
  imageURL: undefined,
}

const load = () => {
  Sb.storiesOf('Chat/Unfurl/Generic', module)
    .addDecorator(story => <Box style={{maxWidth: 1000, padding: 5}}>{story()}</Box>)
    .add('Full', () => <UnfurlGeneric {...full} />)
    .add('Full (no close)', () => <UnfurlGeneric {...noClose} />)
    .add('No Pub', () => <UnfurlGeneric {...missingPub} />)
    .add('No Pub/Desc', () => <UnfurlGeneric {...missingPubDesc} />)
    .add('No Pub/Desc/Image', () => <UnfurlGeneric {...missingPubDescImage} />)
    .add('No Pub/Desc/Image/Fav', () => <UnfurlGeneric {...missingPubDescImageFav} />)
    .add('No Image', () => <UnfurlGeneric {...missingImage} />)
    .add('Full Side', () => <UnfurlGeneric {...fullGithub} />)
    .add('Side No Desc', () => <UnfurlGeneric {...githubMissingDesc} />)
    .add('Side No Image', () => <UnfurlGeneric {...githubMissingImage} />)
}

export default load
