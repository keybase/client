// @flow
import React, {Component} from 'react'
import {Text, Box, Icon} from '../../common-adapters'
import RenderView from './render-view'
import {globalStyles, globalColors, globalMargins} from '../../styles/style-guide'
import {resolve as urlResolve} from 'url'
import openUrl from '../../util/open-url'
import type {PropsSubset as ViewProps} from './render-view'

type Props = ViewProps & {
  onCompleteText?: string,
  baseUrl?: string,
}

const platformProps = (props: Props) => {
  switch (props.platform) {
    case 'twitter':
      return {
        platformSubtitle: '@twitter',
        descriptionView: <Text type='Body'>Please tweet the below text <Text type='Body' style={globalStyles.italic}>exactly as it appears.</Text></Text>,
        proofActionText: 'Tweet it now',
        proofActionIcon: 'iconfont-tweet',
        onCompleteText: 'OK tweeted! Check for it!',
      }
    case 'reddit':
      return {
        platformSubtitle: '@reddit',
        descriptionView: <Text type='Body'>Click the link below and post the form in the subreddit <Text type='Body' style={globalStyles.italic}>KeybaseProofs.</Text></Text>,
        noteText: 'Make sure you\'re signed in to Reddit, and don\'t edit the text or title before submitting.',
        proofActionText: 'Reddit form',
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'github':
      return {
        platformSubtitle: '@github',
        descriptionView: <Text type='Body'>Login to GitHub and paste the text below into a <Text type='BodySemibold'>public</Text> gist called <Text type='Body' style={globalStyles.italic}>keybase.md.</Text></Text>,
        proofActionText: 'Create gist now',
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'coinbase':
      return {
        platformSubtitle: '@coinbase',
        descriptionView: <Text type='Body'>Please paste the below text <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text> as your "public key" on Coinbase.</Text>,
        proofActionText: 'Go to Coinbase to add as "public key"',
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'hackernews':
      return {
        platformSubtitle: '@hackernews',
        descriptionView: <Text type='Body'>Please add the below text <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text> to your profile.</Text>,
        proofActionText: 'Go to Hacker News',
        proofActionIcon: 'iconfont-open-browser',
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'dns':
      return {
        platformSubtitle: 'dns',
        descriptionView: <Text type='Body'>Enter the following as a TXT entry in your DNS zone, <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text>. If you need a "name" for you entry, give it "@".</Text>,
        onCompleteText: 'OK posted! Check for it!',
      }
    case 'genericWebSite':
      const [urlRoot, urlWellKnown] = [urlResolve(props.baseUrl || '', '/keybase.txt'), urlResolve(props.baseUrl || '', '/.well-known/keybase.txt')]
      return {
        platformSubtitle: 'http(s)',
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

export default class Render extends Component<void, Props, void> {
  render () {
    return (
      <RenderView
        {...platformProps(this.props)}
        {...this.props}
      />
    )
  }
}
