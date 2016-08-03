// @flow
import React from 'react'
import {Text, Box, Icon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {resolve as urlResolve} from 'url'
import openUrl from '../util/open-url'
import {subtitle} from '../util/platforms'
import type {Props} from './post-proof'

export function propsForPlatform (props: Props) {
  const base = {
    platformSubtitle: subtitle(props.platform),
  }
  switch (props.platform) {
    case 'twitter':
      return {
        ...base,
        descriptionView: <Text type='Body'>Please tweet the below text <Text type='Body' style={globalStyles.italic}>exactly as it appears.</Text></Text>,
        proofActionText: 'Tweet it now',
        proofActionIcon: 'iconfont-tweet',
        onCompleteText: 'OK tweeted! Check for it!',
      }
    case 'reddit':
      return {
        ...base,
        descriptionView: <Text type='Body'>Click the link below and post the form in the subreddit <Text type='Body' style={globalStyles.italic}>KeybaseProofs.</Text></Text>,
        noteText: 'Make sure you\'re signed in to Reddit, and don\'t edit the text or title before submitting.',
        proofActionText: 'Reddit form',
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'github':
      return {
        ...base,
        descriptionView: <Text type='Body'>Login to GitHub and paste the text below into a <Text type='BodySemibold'>public</Text> gist called <Text type='Body' style={globalStyles.italic}>keybase.md.</Text></Text>,
        proofActionText: 'Create gist now',
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'coinbase':
      return {
        ...base,
        descriptionView: <Text type='Body'>Please paste the below text <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text> as your "public key" on Coinbase.</Text>,
        proofActionText: 'Go to Coinbase to add as "public key"',
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'hackernews':
      return {
        ...base,
        descriptionView: <Text type='Body'>Please add the below text <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text> to your profile.</Text>,
        proofActionText: 'Go to Hacker News',
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'dns':
      return {
        ...base,
        descriptionView: <Text type='Body'>Enter the following as a TXT entry in your DNS zone, <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text>. If you need a "name" for you entry, give it "@".</Text>,
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'genericWebSite':
      const [urlRoot, urlWellKnown] = [urlResolve(props.baseUrl || '', '/keybase.txt'), urlResolve(props.baseUrl || '', '/.well-known/keybase.txt')]
      return {
        ...base,
        descriptionView: (
          <Box>
            <Text type='Body'>Please serve the text below <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text> at one of these URL's.</Text>
            {props.baseUrl && <Text type='BodyPrimaryLink' style={{display: 'block'}} onClick={() => openUrl(urlRoot)}><Icon type='iconfont-open-browser' style={{marginRight: globalMargins.xtiny, color: globalColors.blue}} />{urlRoot}</Text>}
            {props.baseUrl && <Text type='BodyPrimaryLink' style={{display: 'block'}} onClick={() => openUrl(urlWellKnown)}><Icon type='iconfont-open-browser' style={{marginRight: globalMargins.xtiny, color: globalColors.blue}} />{urlWellKnown}</Text>}
          </Box>
        ),
        noteText: 'Note: If someone already verified this domain, just append to the existing keybase.txt file.',
        onCompleteText: 'OK posted! Check for it!',
      }
  }
}
