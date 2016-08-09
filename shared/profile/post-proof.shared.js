// @flow
import React from 'react'
import openUrl from '../util/open-url'
import type {IconType} from '../common-adapters/icon.constants'
import type {Props} from './post-proof'
import {Text, Box, Icon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {resolve as urlResolve} from 'url'
import {subtitle} from '../util/platforms'

type MoreProps = {
  descriptionView?: ?any,
  noteText?: ?string,
  onCompleteText?: ?string,
  proofText?: ?string,
  platformSubtitle?: ?string,
  proofActionIcon?: ?IconType,
  proofActionText?: ?string,
}
export function propsForPlatform (props: Props): MoreProps {
  const base = {
    platformSubtitle: subtitle(props.platform),
  }

  switch (props.platform) {
    case 'twitter':
      return {
        ...base,
        descriptionView: <Text type='Body'>Please tweet the below text <Text type='Body' style={globalStyles.italic}>exactly as it appears.</Text></Text>,
        proofActionText: 'Tweet it now',
        proofText: props.proofText,
        proofActionIcon: 'iconfont-tweet',
        onCompleteText: 'OK tweeted! Check for it!',
        noteText: null,
      }
    case 'reddit':
      return {
        ...base,
        descriptionView: <Text type='Body'>Click the link below and post the form in the subreddit <Text type='Body' style={globalStyles.italic}>KeybaseProofs.</Text></Text>,
        noteText: 'Make sure you\'re signed in to Reddit, and don\'t edit the text or title before submitting.',
        proofText: null,
        proofActionText: 'Reddit form',
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'github':
      return {
        ...base,
        descriptionView: <Text type='Body'>Login to GitHub and paste the text below into a <Text type='BodySemibold'>public</Text> gist called <Text type='Body' style={globalStyles.italic}>keybase.md.</Text></Text>,
        proofActionText: 'Create gist now',
        proofText: props.proofText,
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
        noteText: null,
      }
    case 'coinbase':
      return {
        ...base,
        descriptionView: <Text type='Body'>Please paste the below text <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text> as your "public key" on Coinbase.</Text>,
        proofActionText: 'Go to Coinbase to add as "public key"',
        proofText: props.proofText,
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
        noteText: null,
      }
    case 'hackernews':
      return {
        ...base,
        descriptionView: <Text type='Body'>Please add the below text <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text> to your profile.</Text>,
        proofActionText: 'Go to Hacker News',
        proofActionIcon: 'iconfont-open-browser',
        proofText: props.proofText,
        onCompleteText: 'OK posted! Check for it!',
        noteText: null,
      }
    case 'dns':
      return {
        ...base,
        descriptionView: <Text type='Body'>Enter the following as a TXT entry in your DNS zone, <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text>. If you need a "name" for you entry, give it "@".</Text>,
        onCompleteText: 'OK posted! Check for it!',
        proofText: props.proofText,
        noteText: null,
        proofActionIcon: null,
      }
    case 'http':
    case 'https':
      const root = `${props.platform}://${props.platformUserName}`
      const [urlRoot, urlWellKnown] = ['/keybase.txt', '/.well-known/keybase.txt'].map(file => urlResolve(root, file))

      return {
        ...base,
        proofText: props.proofText,
        proofActionIcon: null,
        descriptionView: (
          <Box>
            <Text type='Body'>Please serve the text below <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text> at one of these URL's.</Text>
            {props.platformUserName && <Text type='BodyPrimaryLink' style={{display: 'block'}} onClick={() => openUrl(urlRoot)}><Icon type='iconfont-open-browser' style={{marginRight: globalMargins.xtiny, color: globalColors.blue}} />{urlRoot}</Text>}
            {props.platformUserName && <Text type='BodyPrimaryLink' style={{display: 'block'}} onClick={() => openUrl(urlWellKnown)}><Icon type='iconfont-open-browser' style={{marginRight: globalMargins.xtiny, color: globalColors.blue}} />{urlWellKnown}</Text>}
          </Box>
        ),
        noteText: 'Note: If someone already verified this domain, just append to the existing keybase.txt file.',
        onCompleteText: 'OK posted! Check for it!',
      }
    default:
      return { }
  }
}
