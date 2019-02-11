// @flow
import FacebookDescription from '../facebook-description'
import * as React from 'react'
import openUrl from '../../util/open-url'
import {Box, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {subtitle} from '../../util/platforms'
import type {Props} from '.'

type MoreProps = {
  descriptionView?: ?any,
  noteText?: ?string,
  onCompleteText?: ?string,
  proofText?: ?string,
  platformSubtitle?: ?string,
  proofActionText?: ?string,
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
          <Text center={true} type="BodySemibold">
            Please tweet the text below{' '}
            <Text type="BodySemiboldItalic" style={{...globalStyles.italic}}>
              exactly as it appears.
            </Text>
          </Text>
        ),
        noteText: null,
        onCompleteText: 'OK tweeted! Check for it!',
        proofActionText: 'Tweet it now',
        proofText: props.proofText,
      }
    case 'reddit':
      return {
        ...base,
        descriptionView: (
          <Text center={true} type="BodySemibold">
            Click the link below and post the form in the subreddit{' '}
            <Text type="BodySemiboldItalic">KeybaseProofs</Text>.
          </Text>
        ),
        noteText: "Make sure you're signed in to Reddit, and don't edit the text or title before submitting.",
        onCompleteText: 'OK posted! Check for it!',
        proofActionText: 'Reddit form',
        proofText: null,
      }
    case 'facebook':
      return {
        ...base,
        descriptionView: <FacebookDescription />,
        onCompleteText: 'OK posted! Check for it!',
        proofActionText: 'Continue with Facebook',
        proofText: null,
      }
    case 'github':
      return {
        ...base,
        descriptionView: (
          <Text center={true} type="BodySemibold">
            Login to GitHub and paste the text below into a <Text type="BodySemiboldItalic">public</Text> gist
            called <Text type="BodySemiboldItalic">keybase.md.</Text>
          </Text>
        ),
        noteText: null,
        onCompleteText: 'OK posted! Check for it!',
        proofActionText: 'Create gist now',
        proofText: props.proofText,
      }
    case 'hackernews':
      return {
        ...base,
        descriptionView: (
          <Text center={true} type="BodySemibold">
            Please add the below text{' '}
            <Text type="BodySemibold" style={{...globalStyles.italic}}>
              exactly as it appears
            </Text>{' '}
            to your profile.
          </Text>
        ),
        noteText: null,
        onCompleteText: 'OK posted! Check for it!',
        proofActionText: 'Go to Hacker News',
        proofText: props.proofText,
      }
    case 'dns':
      return {
        ...base,
        descriptionView: (
          <Text center={true} type="BodySemibold">
            Enter the following as a TXT entry in your DNS zone,{' '}
            <Text type="BodySemibold">exactly as it appears</Text>. If you need a "name" for your entry, give
            it "@".
          </Text>
        ),
        noteText: null,
        onCompleteText: 'OK posted! Check for it!',
        proofText: props.proofText,
      }
    case 'http':
    case 'https':
    case 'web':
      const root = props.platformUserName
      const [urlRoot, urlWellKnown] = ['/keybase.txt', '/.well-known/keybase.txt'].map(file => root + file)

      return {
        ...base,
        descriptionView: (
          <Box style={globalStyles.flexBoxColumn}>
            <Text center={true} type="BodySemibold">
              Please serve the text below <Text type="BodySemiboldItalic">exactly as it appears</Text> at one
              of these URL's.
            </Text>
            <Text
              type="BodyPrimaryLink"
              center={true}
              onClick={() => openUrl(urlRoot)}
              style={{color: globalColors.blue, marginTop: globalMargins.tiny}}
            >
              {urlRoot}
            </Text>
            <Text
              type="BodyPrimaryLink"
              center={true} onClick={() => openUrl(urlWellKnown)}
              style={{color: globalColors.blue}}
            >
              {urlWellKnown}
            </Text>
          </Box>
        ),
        noteText:
          'Note: If someone already verified this domain, just append to the existing keybase.txt file.',
        onCompleteText: 'OK posted! Check for it!',
        proofText: props.proofText,
      }
    default:
      return {}
  }
}
