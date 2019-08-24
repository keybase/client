import * as React from 'react'
import {Box} from '../../../../../../common-adapters/index'
import * as Sb from '../../../../../../stories/storybook'
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import UnfurlList from '.'

const provider = Sb.createPropProviderWithCommon({
  UnfurlGeneric: p => ({
    description: p.unfurl.description,
    faviconURL: p.unfurl.faviconURL,
    imageURL: p.unfurl.image ? p.unfurl.image.url : undefined,
    onClose: p.onClose,
    onCollapse: p.onCollapse,
    publishTime: p.unfurl.publishTime,
    showImageOnSide: p.unfurl.image ? p.unfurl.image.height >= p.unfurl.image.width : false,
    siteName: p.unfurl.siteName,
    title: p.unfurl.title,
    url: p.unfurl.url,
  }),
})

const unfurls = [
  {
    isCollapsed: false,
    onClose: Sb.action('onClose'),
    onCollapse: Sb.action('onCollapse'),
    unfurl: {
      generic: {
        description:
          'A surge in technology shares following Facebook’s latest earnings lifted U.S. stocks, helping major indexes trim some of their October declines following a punishing period for global investors.',
        favicon: {
          height: 20,
          isVideo: false,
          url: require('../../../../../../images/mock/wsj.jpg'),
          width: 20,
        },
        image: {
          height: 400,
          url: require('../../../../../../images/mock/wsj_image.jpg'),
          width: 900,
        },
        onClose: Sb.action('onClose'),
        publishTime: 1542241021655,
        siteName: 'WSJ',
        title: 'U.S. Stocks Jump as Tough Month Sets to Wrap',
        url: 'https://www.wsj.com/articles/global-stocks-rally-to-end-a-tough-month-1540976261',
      },
      unfurlType: RPCChatTypes.UnfurlType.generic,
    },
    url: 'https://www.wsj.com/articles/global-stocks-rally-to-end-a-tough-month-1540976261',
  },
  {
    isCollapsed: false,
    onClose: Sb.action('onClose'),
    onCollapse: Sb.action('onCollapse'),
    unfurl: {
      generic: {
        description: 'Keybase Go Library, Client, Service, OS X, iOS, Android, Electron - keybase/client',
        favicon: {
          height: 20,
          isVideo: false,
          url: require('../../../../../../images/mock/github_fav.jpg'),
          width: 20,
        },
        image: {
          height: 150,
          url: require('../../../../../../images/mock/github.jpg'),
          width: 150,
        },
        siteName: 'GitHub',
        title: 'keybase/client',
        url: 'https://github.com/keybase/client"',
      },
      unfurlType: RPCChatTypes.UnfurlType.generic,
    },
    url: 'https://github.com/keybase/client"',
  },
]

const props = {
  unfurls,
}

const load = () => {
  Sb.storiesOf('Chat/Unfurl/Unfurl-List', module)
    .addDecorator(story => <Box style={{maxWidth: 600, padding: 5}}>{story()}</Box>)
    .addDecorator(provider)
    // @ts-ignore codemod issue
    .add('Default', () => <UnfurlList {...props} />)
}

export default load
