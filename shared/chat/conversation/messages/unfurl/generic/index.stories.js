// @flow
import * as React from 'react'
import {Box} from '../../../../../common-adapters/index'
import * as Sb from '../../../../../stories/storybook'

import UnfurlGeneric from '.'

const full = {
  title: 'U.S. Stocks Jump as Tough Month Sets to Wrap',
  url: 'https://www.wsj.com/articles/global-stocks-rally-to-end-a-tough-month-1540976261',
  siteName: 'WSJ',
  publishTime: Date.now() - 86400 * 1000,
  description:
    'A surge in technology shares following Facebook’s latest earnings lifted U.S. stocks, helping major indexes trim some of their October declines following a punishing period for global investors.',
  onClose: Sb.action('onClose'),
  faviconURL: require('../../../../../images/mock/wsj.jpg'),
  image: {
    url: 'https://images.wsj.net/im-33925/social',
    height: 471,
    width: 970,
  },
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
  image: undefined,
}

const missingPubDescImageFav = {
  ...missingPubDescImage,
  faviconURL: undefined,
}

const missingImage = {
  ...full,
  image: undefined,
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
}

export default load
