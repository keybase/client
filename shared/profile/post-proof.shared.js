// @flow
import React from 'react'
import openUrl from '../util/open-url'
import type {IconType} from '../common-adapters/icon.constants'
import type {Props} from './post-proof'
import {Box, LinkWithIcon, Text} from '../common-adapters'
import {globalStyles, globalColors} from '../styles'
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

const styleCentered = {
  style: {
    textAlign: 'center',
  },
}

export function propsForPlatform (props: Props): MoreProps {
  const base = {
    platformSubtitle: subtitle(props.platform),
  }

  switch (props.platform) {
    case 'twitter':
      return {
        ...base,
        descriptionView: <Text type='Body' {...styleCentered}>Please tweet the text below <Text type='Body' style={globalStyles.italic}>exactly as it appears.</Text></Text>,
        proofActionText: 'Tweet it now',
        proofText: props.proofText,
        proofActionIcon: 'iconfont-tweet',
        onCompleteText: 'OK tweeted! Check for it!',
        noteText: null,
      }
    case 'reddit':
      return {
        ...base,
        descriptionView: <Text type='Body' {...styleCentered}>Click the link below and post the form in the subreddit <Text type='Body' style={globalStyles.italic}>KeybaseProofs.</Text></Text>,
        noteText: 'Make sure you\'re signed in to Reddit, and don\'t edit the text or title before submitting.',
        proofText: null,
        proofActionText: 'Reddit form',
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'facebook':
      return {
        ...base,
        descriptionView: <Text type='Body' {...styleCentered}>Click the link below and post.</Text>,
        noteText: 'Make sure you\'re signed in to Facebook, and don\'t edit the text or title before submitting.',
        proofText: null,
        proofActionText: 'Facebook form',
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'github':
      return {
        ...base,
        descriptionView: <Text type='Body' {...styleCentered}>Login to GitHub and paste the text below into a <Text type='BodySemibold'>public</Text> gist called <Text type='Body' style={globalStyles.italic}>keybase.md.</Text></Text>,
        proofActionText: 'Create gist now',
        proofText: props.proofText,
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
        noteText: null,
      }
    case 'coinbase':
      return {
        ...base,
        descriptionView: <Text type='Body' {...styleCentered}>Please paste the below text <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text> as your "public key" on Coinbase.</Text>,
        proofActionText: 'Go to Coinbase to add as "public key"',
        proofText: props.proofText,
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
        noteText: null,
      }
    case 'hackernews':
      return {
        ...base,
        descriptionView: <Text type='Body' {...styleCentered}>Please add the below text <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text> to your profile.</Text>,
        proofActionText: 'Go to Hacker News',
        proofActionIcon: 'iconfont-open-browser',
        proofText: props.proofText,
        onCompleteText: 'OK posted! Check for it!',
        noteText: null,
      }
    case 'dns':
      return {
        ...base,
        descriptionView: <Text type='Body' {...styleCentered}>Enter the following as a TXT entry in your DNS zone, <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text>. If you need a "name" for you entry, give it "@".</Text>,
        onCompleteText: 'OK posted! Check for it!',
        proofText: props.proofText,
        noteText: null,
        proofActionIcon: null,
      }
    case 'http':
    case 'https':
      const root = `${props.platform}://${props.platformUserName}`
      const [urlRoot, urlWellKnown] = ['/keybase.txt', '/.well-known/keybase.txt'].map(file => root + file)

      return {
        ...base,
        proofText: props.proofText,
        proofActionIcon: null,
        descriptionView: (
          <Box>
            <Text type='Body' {...styleCentered}>Please serve the text below <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text> at one of these URL's.</Text>
            <LinkWithIcon icon='iconfont-open-browser' onClick={() => openUrl(urlRoot)} label={urlRoot} color={globalColors.blue} />
            <LinkWithIcon icon='iconfont-open-browser' onClick={() => openUrl(urlWellKnown)} label={urlWellKnown} color={globalColors.blue} />
          </Box>
        ),
        noteText: 'Note: If someone already verified this domain, just append to the existing keybase.txt file.',
        onCompleteText: 'OK posted! Check for it!',
      }
    default:
      return { }
  }
}
