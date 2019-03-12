// @flow
import * as React from 'react'
import * as Constants from '../../constants/profile'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {subtitle} from '../../util/platforms'
import type {ProvablePlatformsType} from '../../constants/types/more'

export type Props = {|
  copyToClipboard: string => void,
  errorMessage: string,
  onCancel: () => void,
  onOpenLink: () => void,
  onSubmit: () => void,
  openLinkBeforeSubmit: boolean,
  platform: ProvablePlatformsType,
  platformUserName: string,
  proofText: string,
  url: string,
|}

const actionMap: {[key: string]: ?string} = {
  github: 'Create gist now',
  hackernews: 'Go to Hacker News',
  reddit: 'Reddit form',
  twitter: 'Tweet it now',
}

const checkMap = {[key: string]: ?string} = {
        twitter: 'OK tweeted! Check for it!',
    reddit : 'OK posted! Check for it!',
    facebook : '',
    'github': 'OK posted! Check for it!',
    'hackernews': 'OK posted! Check for it!',
    'dns': 'OK posted! Check for it!',
    'http': 'OK posted! Check for it!',
    'https': 'OK posted! Check for it!',
    'web': 'OK posted! Check for it!',
}

const webNote = 'Note: If someone already verified this domain, just append to the existing keybase.txt file.'

const noteMap = {[key: string]: ?string} = {
    'http': webNote,
    'https': webNote,
    'web': webNote,
}

const WebDescription = ({platformUserName}) => (
          <Kb.Box style={Styles.globalStyles.flexBoxColumn}>
            <Kb.Text center={true} type="BodySemibold">
              Please serve the text below <Kb.Text type="BodySemiboldItalic">exactly as it appears</Kb.Text>{' '}
              at one of these URL's.
            </Kb.Text>
            <Kb.Text
              type="BodyPrimaryLink"
              center={true}
              onClick={() => openUrl(`${urlRoot}/keybase.txt`)}
              style={{color: globalColors.blue, marginTop: globalMargins.tiny}}
            >
              {urlRoot}
            </Kb.Text>
            <Kb.Text
              type="BodyPrimaryLink"
              center={true}
              onClick={() => openUrl(`${urlRoot}/.well-known/keybase.txt`)}
              style={{color: globalColors.blue}}
            >
              {urlWellKnown}
            </Kb.Text>
          </Kb.Box>
        )

const descriptionMap  = {
  twitter: () => (
          <Kb.Text center={true} type="BodySemibold">
            Please tweet the text below{' '}
            <Kb.Text type="BodySemiboldItalic" style={{...Styles.globalStyles.italic}}>
              exactly as it appears.
            </Kb.Text>
          </Kb.Text>
  ),
  reddit: () => (
          <Kb.Text center={true} type="BodySemibold">
            Click the link below and post the form in the subreddit{' '}
            <Kb.Text type="BodySemiboldItalic">KeybaseProofs</Kb.Text>.
          </Kb.Text>
        ),

  github: () => (
          <Kb.Text center={true} type="BodySemibold">
            Login to GitHub and paste the text below into a{' '}
            <Kb.Text type="BodySemiboldItalic">public</Kb.Text> gist called{' '}
            <Kb.Text type="BodySemiboldItalic">keybase.md.</Kb.Text>
          </Kb.Text>
        ),
  hackernews: () => (
          <Kb.Text center={true} type="BodySemibold">
            Please add the below text{' '}
            <Kb.Text type="BodySemibold" style={{...globalStyles.italic}}>
              exactly as it appears
            </Kb.Text>{' '}
            to your profile.
          </Kb.Text>
        ),

  dns: () => (
          <Kb.Text center={true} type="BodySemibold">
            Enter the following as a TXT entry in your DNS zone,{' '}
            <Kb.Text type="BodySemibold">exactly as it appears</Kb.Text>. If you need a "name" for your entry,
            give it "@".
          </Kb.Text>
        ),
  web: WebDescription,
  http: WebDescription,
  https: WebDescription,
}

const PostProof = (props: Props) => {
  const {, noteText, onCompleteText, platformSubtitle} = {
    noteText: '',
    platformSubtitle: subtitle(props.platform),
    ...propsForPlatform(props),
  }
  const proofActionText = actionMap[props.platform] || ''
  const DescriptionView = descriptionMap[props.platform]
  const {proofAction, proofText} = props

  return (
    <Kb.Box
      style={styleContainer}
      onCopyCapture={e => {
        // disallow copying the whole screen by accident
        e.preventDefault()
        proofText && props.copyToClipboard(proofText)
      }}
    >
      <Kb.Icon
        style={styleClose}
        type="iconfont-close"
        color={Styles.globalColors.black_10}
        onClick={() => props.onCancel()}
      />
      {!!props.errorMessage && (
        <Kb.Box style={styleErrorBanner}>
          <Kb.Text center={true} style={styleErrorBannerText} type="BodySemibold">
            {props.errorMessage}
          </Kb.Text>
        </Kb.Box>
      )}
      <Kb.Box style={{...Styles.globalStyles.flexBoxRow, flex: 1}}>
        <Kb.Box style={styleContentContainer}>
          <Kb.PlatformIcon
            platform={props.platform}
            overlay="icon-proof-unfinished"
            overlayColor={Styles.globalColors.grey}
          />
          <Kb.Text
            style={{
              ...stylePlatformUsername,
              ...(stylePlatformSubtitle ? {} : {marginBottom: Styles.globalMargins.medium}),
            }}
            type="Header"
          >
            {props.platformUserName}
          </Kb.Text>
          {!!platformSubtitle && (
            <Kb.Text style={stylePlatformSubtitle} type="Body">
              {platformSubtitle}
            </Kb.Text>
          )}
          <DescriptionView platformUserName={props.platformUserName}/>
          {!!proofText && <Kb.CopyableText style={styleProofText} value={proofText} />}
          {!!noteText && (
            <Kb.Text style={styleNoteText} type="Body">
              {noteText}
            </Kb.Text>
          )}
          <Kb.Box style={styleButtonsContainer}>
            {!!props.onCancelText && (
              <Kb.Button
                type="Secondary"
                onClick={() => props.onCancel()}
                label={props.onCancelText || 'Cancel'}
                style={{marginRight: Styles.globalMargins.tiny}}
              />
            )}
            {!!proofAction && !props.allowProofCheck && (
              <Kb.Button
                type="Primary"
                onClick={() => {
                  props.onAllowProofCheck(true)
                  proofAction()
                }}
                label={proofActionText || ''}
              />
            )}
            {props.allowProofCheck && (
              <Kb.WaitingButton
                type="Primary"
                onClick={() => props.onComplete()}
                label={onCompleteText || ''}
                waitingKey={Constants.waitingKey}
              />
            )}
          </Kb.Box>
        </Kb.Box>
      </Kb.Box>
    </Kb.Box>
  )
}

const styleContainer = {
  ...Styles.globalStyles.flexBoxColumn,
  flex: 1,
  paddingBottom: Styles.globalMargins.large,
  paddingTop: Styles.globalMargins.large,
  position: 'relative',
  ...Styles.desktopStyles.scrollable,
}

const styleClose = Styles.collapseStyles([
  {
    position: 'absolute',
    right: Styles.globalMargins.small,
    top: Styles.globalMargins.small,
  },
  Styles.desktopStyles.clickable,
])

const styleErrorBanner = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: Styles.globalColors.red,
  justifyContent: 'center',
  marginTop: -Styles.globalMargins.large,
  minHeight: Styles.globalMargins.large,
  padding: Styles.globalMargins.tiny,
  width: '100%',
  zIndex: 1,
}

const styleErrorBannerText = {color: Styles.globalColors.white}

const styleContentContainer = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
  margin: Styles.globalMargins.large,
  textAlign: 'center',
  width: '100%',
}

const stylePlatformUsername = {
  color: Styles.globalColors.blue,
}

const stylePlatformSubtitle = {
  color: Styles.globalColors.black_20,
  marginBottom: Styles.globalMargins.medium,
}

const styleProofText = {
  flexGrow: 1,
  marginTop: Styles.globalMargins.small,
  minHeight: 116,
  width: '100%',
}

const styleNoteText = {
  marginTop: Styles.globalMargins.tiny,
}

const styleButtonsContainer = {
  ...Styles.globalStyles.flexBoxRow,
  flexShrink: 0,
  marginBottom: Styles.globalMargins.medium,
  marginTop: Styles.globalMargins.medium,
}

export default PostProof
