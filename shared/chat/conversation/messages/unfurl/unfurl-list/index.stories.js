// @flow
import * as React from 'react'
import {Box} from '../../../../../common-adapters/index'
import * as Sb from '../../../../../stories/storybook'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import UnfurlList from '.'

const provider = Sb.createPropProviderWithCommon({
  UnfurlGeneric: p => ({
    title: p.unfurl.title,
    url: p.unfurl.url,
    siteName: p.unfurl.siteName,
    description: p.unfurl.description,
    publishTime: p.unfurl.publishTime,
    faviconURL: p.unfurl.faviconURL,
    imageURL: p.unfurl.image ? p.unfurl.image.url : undefined,
    onClose: p.onClose,
    showImageOnSide: p.unfurl.image ? p.unfurl.image.height >= p.unfurl.image.width : false,
  }),
})

const unfurls = [
  {
    onClose: Sb.action('onClose'),
    url: 'https://www.wsj.com/articles/global-stocks-rally-to-end-a-tough-month-1540976261',
    unfurl: {
      unfurlType: RPCChatTypes.unfurlUnfurlType.generic,
      generic: {
        title: 'U.S. Stocks Jump as Tough Month Sets to Wrap',
        url: 'https://www.wsj.com/articles/global-stocks-rally-to-end-a-tough-month-1540976261',
        siteName: 'WSJ',
        publishTime: 1542241021655,
        description:
          'A surge in technology shares following Facebook’s latest earnings lifted U.S. stocks, helping major indexes trim some of their October declines following a punishing period for global investors.',
        onClose: Sb.action('onClose'),
        favicon: {
          height: 20,
          width: 20,
          url: require('../../../../../images/mock/wsj.jpg'),
        },
        image: {
          height: 400,
          width: 900,
          url: require('../../../../../images/mock/wsj_image.jpg'),
        },
      },
    },
  },
  {
    onClose: Sb.action('onClose'),
    url: 'https://github.com/keybase/client"',
    unfurl: {
      unfurlType: RPCChatTypes.unfurlUnfurlType.generic,
      generic: {
        title: 'keybase/client',
        url: 'https://github.com/keybase/client"',
        siteName: 'GitHub',
        description: 'Keybase Go Library, Client, Service, OS X, iOS, Android, Electron - keybase/client',
        favicon: {
          height: 20,
          width: 20,
          url: require('../../../../../images/mock/github_fav.jpg'),
        },
        image: {
          height: 150,
          width: 150,
          url: require('../../../../../images/mock/github.jpg'),
        },
      },
    },
  },
]

const props = {
  unfurls,
}

const load = () => {
  Sb.storiesOf('Chat/Unfurl/Unfurl-List', module)
    .addDecorator(story => <Box style={{maxWidth: 600, padding: 5}}>{story()}</Box>)
    .addDecorator(provider)
    .add('Default', () => <UnfurlList {...props} />)
}

export default load
