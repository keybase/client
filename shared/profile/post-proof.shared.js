// @flow
import FacebookDescription from './facebook-description'
import React from 'react'
import openUrl from '../util/open-url'
import {Box, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {subtitle} from '../util/platforms'

import type {IconType} from '../common-adapters/icon.constants'
import type {Props} from './post-proof'

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

export function propsForPlatform(props: Props): MoreProps {
  const base = {
    platformSubtitle: subtitle(props.platform),
  }

  switch (props.platform) {
    case 'twitter':
      return {
        ...base,
        descriptionView: (
          <Text type="BodySemibold" {...styleCentered}>
            Please tweet the text below
            {' '}
            <Text type="BodySemiboldItalic" style={globalStyles.italic}>
              exactly as it appears.
            </Text>
          </Text>
        ),
        proofActionText: 'Tweet it now',
        proofText: props.proofText,
        proofActionIcon: 'iconfont-tweet',
        onCompleteText: 'OK tweeted! Check for it!',
        noteText: null,
      }
    case 'reddit':
      return {
        ...base,
        descriptionView: (
          <Text type="BodySemibold" {...styleCentered}>
            Click the link below and post the form in the subreddit
            {' '}
            <Text type="BodySemiboldItalic">KeybaseProofs</Text>
            .
          </Text>
        ),
        noteText: "Make sure you're signed in to Reddit, and don't edit the text or title before submitting.",
        proofText: null,
        proofActionText: 'Reddit form',
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'facebook':
      return {
        ...base,
        descriptionView: <FacebookDescription />,
        proofText: null,
        proofActionText: 'Make a Facebook post',
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'github':
      return {
        ...base,
        descriptionView: (
          <Text type="BodySemibold" {...styleCentered}>
            Login to GitHub and paste the text below into a
            {' '}
            <Text type="BodySemiboldItalic">public</Text>
            {' '}
            gist called
            {' '}
            <Text type="BodySemiboldItalic">keybase.md.</Text>
          </Text>
        ),
        proofActionText: 'Create gist now',
        proofText: props.proofText,
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
        noteText: null,
      }
    case 'coinbase':
      return {
        ...base,
        descriptionView: (
          <Text type="BodySemibold" {...styleCentered}>
            Please paste the below text
            {' '}
            <Text type="BodySemiboldItalic" style={globalStyles.italic}>
              exactly as it appears
            </Text>
            {' '}
            as your "public key" on Coinbase.
          </Text>
        ),
        proofActionText: 'Go to Coinbase to add as "public key"',
        proofText: props.proofText,
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
        noteText: null,
      }
    case 'hackernews':
      return {
        ...base,
        descriptionView: (
          <Text type="BodySemibold" {...styleCentered}>
            Please add the below text
            {' '}
            <Text type="BodySemibold" style={globalStyles.italic}>
              exactly as it appears
            </Text>
            {' '}
            to your profile.
          </Text>
        ),
        proofActionText: 'Go to Hacker News',
        proofActionIcon: 'iconfont-open-browser',
        proofText: props.proofText,
        onCompleteText: 'OK posted! Check for it!',
        noteText: null,
      }
    case 'dns':
      return {
        ...base,
        descriptionView: (
          <Text type="BodySemibold" {...styleCentered}>
            Enter the following as a TXT entry in your DNS zone,
            {' '}
            <Text type="BodySemibold">exactly as it appears</Text>
            . If you need a "name" for your entry, give it "@".
          </Text>
        ),
        onCompleteText: 'OK posted! Check for it!',
        proofText: props.proofText,
        noteText: null,
        proofActionIcon: null,
      }
    case 'http':
    case 'https':
      const root = `${props.platform}://${props.platformUserName}`
      const [urlRoot, urlWellKnown] = ['/keybase.txt', '/.well-known/keybase.txt'].map(
        file => root + file
      )

      return {
        ...base,
        proofText: props.proofText,
        proofActionIcon: null,
        descriptionView: (
          <Box style={{...globalStyles.flexBoxColumn}}>
            <Text type="BodySemibold" {...styleCentered}>
              Please serve the text below
              {' '}
              <Text type="BodySemiboldItalic">exactly as it appears</Text>
              {' '}
              at one of these URL's.
            </Text>
            <Text
              type="BodyPrimaryLink"
              onClick={() => openUrl(urlRoot)}
              style={{
                color: globalColors.blue,
                textAlign: 'center',
                marginTop: globalMargins.tiny,
              }}
            >
              {urlRoot}
            </Text>
            <Text
              type="BodyPrimaryLink"
              onClick={() => openUrl(urlWellKnown)}
              style={{color: globalColors.blue, textAlign: 'center'}}
            >
              {urlWellKnown}
            </Text>
          </Box>
        ),
        noteText: 'Note: If someone already verified this domain, just append to the existing keybase.txt file.',
        onCompleteText: 'OK posted! Check for it!',
      }
    default:
      return {}
  }
}
