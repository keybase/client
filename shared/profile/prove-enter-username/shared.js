// @flow
import type {PlatformsExpandedType} from '../../constants/types/more'

function standardText(name: string) {
  return {
    floatingLabelText: `Your ${name} username`,
    headerText: `Prove your ${name} identity`,
    hintText: `Your ${name} username`,
  }
}

export const platformText: {
  [key: PlatformsExpandedType]: {headerText: string, floatingLabelText?: string, hintText?: string},
} = {
  btc: {
    floatingLabelText: 'Your Bitcoin address',
    headerText: 'Set a Bitcoin address',
    hintText: 'Your Bitcoin address',
  },
  dns: {
    headerText: 'Prove your domain',
    hintText: 'yourdomain.com',
  },
  facebook: standardText('Facebook'),
  github: standardText('GitHub'),
  hackernews: standardText('Hacker News'),
  http: {
    headerText: 'Prove your http website',
    hintText: 'http://whatever.yoursite.com',
  },
  https: {
    headerText: 'Prove your https website',
    hintText: 'https://whatever.yoursite.com',
  },
  reddit: standardText('Reddit'),
  twitter: standardText('Twitter'),
  web: {
    headerText: 'Prove your website',
    hintText: 'whatever.yoursite.com',
  },
  zcash: {
    floatingLabelText: 'Your Zcash address',
    headerText: 'Set a Zcash address',
    hintText: 'Your z_address or t_address',
  },
}
