import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {subtitle} from '@/util/platforms'
import openUrl from '@/util/open-url'
import type * as T from '@/constants/types'
import Modal from '../modal'

export type Props = {
  copyToClipboard: (arg0: string) => void
  errorMessage: string
  onCancel: () => void
  onSubmit: () => void
  openLinkBeforeSubmit: boolean
  platform: T.More.ProvablePlatformsType
  platformUserName: string
  proofText: string
  url: string
}

const actionMap = new Map([
  ['github', 'Create gist now'],
  ['hackernews', 'Go to Hacker News'],
  ['reddit', 'Reddit form'],
  ['twitter', 'Tweet it now'],
])

const checkMap = new Map([['twitter', 'OK tweeted! Check for it!']])

const webNote = 'Note: If someone already verified this domain, just append to the existing keybase.txt file.'

const noteMap = new Map([
  ['http', webNote],
  ['https', webNote],
  ['reddit', "Make sure you're signed in to Reddit, and don't edit the text or title before submitting."],
  ['web', webNote],
])

const WebDescription = ({platformUserName}: {platformUserName: string}) => {
  const root = `${platformUserName}/keybase.txt`
  const wellKnown = `${platformUserName}/.well-known/keybase.txt`
  return (
    <Kb.Box style={Kb.Styles.globalStyles.flexBoxColumn}>
      <Kb.Text center={true} type="BodySemibold">
        Please serve the text below <Kb.Text type="BodySemiboldItalic">exactly as it appears</Kb.Text> at one
        of these URL's.
      </Kb.Text>
      <Kb.Text
        type="BodyPrimaryLink"
        center={true}
        onClickURL={`https://${root}`}
        style={{color: Kb.Styles.globalColors.blueDark, marginTop: Kb.Styles.globalMargins.tiny}}
      >
        {root}
      </Kb.Text>
      <Kb.Text
        type="BodyPrimaryLink"
        center={true}
        onClickURL={`https://${wellKnown}`}
        style={{color: Kb.Styles.globalColors.blueDark}}
      >
        {wellKnown}
      </Kb.Text>
    </Kb.Box>
  )
}

const descriptionMap = new Map([
  [
    'dns',
    () => (
      <Kb.Text center={true} type="BodySemibold">
        Enter the following as a TXT entry in your DNS zone,{' '}
        <Kb.Text type="BodySemibold">exactly as it appears</Kb.Text>. If you need a "name" for your entry,
        give it "@".
      </Kb.Text>
    ),
  ],
  [
    'github',
    () => (
      <Kb.Text center={true} type="BodySemibold">
        Login to GitHub and paste the text below into a <Kb.Text type="BodySemiboldItalic">public</Kb.Text>{' '}
        gist called <Kb.Text type="BodySemiboldItalic">keybase.md.</Kb.Text>
      </Kb.Text>
    ),
  ],
  [
    'hackernews',
    () => (
      <Kb.Text center={true} type="BodySemibold">
        Please add the below text{' '}
        <Kb.Text type="BodySemibold" style={{...Kb.Styles.globalStyles.italic}}>
          exactly as it appears
        </Kb.Text>{' '}
        to your profile.
      </Kb.Text>
    ),
  ],
  ['http', WebDescription],
  ['https', WebDescription],
  [
    'reddit',
    () => (
      <Kb.Text center={true} type="BodySemibold">
        Click the button below and post the form in the subreddit{' '}
        <Kb.Text type="BodySemiboldItalic">KeybaseProofs</Kb.Text>.
      </Kb.Text>
    ),
  ],
  [
    'twitter',
    () => (
      <Kb.Text center={true} type="BodySemibold">
        Please tweet the text below{' '}
        <Kb.Text type="BodySemiboldItalic" style={{...Kb.Styles.globalStyles.italic}}>
          exactly as it appears.
        </Kb.Text>
      </Kb.Text>
    ),
  ],
  ['web', WebDescription],
])

type State = {
  showSubmit: boolean
}

class PostProof extends React.Component<Props, State> {
  state = {
    showSubmit: !this.props.openLinkBeforeSubmit,
  }
  render() {
    const props = this.props
    const platformSubtitle = subtitle(props.platform)
    const proofActionText = actionMap.get(props.platform) ?? ''
    const onCompleteText = checkMap.get(props.platform) ?? 'OK posted! Check for it!'
    const noteText = noteMap.get(props.platform) ?? ''
    const DescriptionView = descriptionMap.get(props.platform) ?? null
    const {proofText} = props

    return (
      <Modal onCancel={props.onCancel} skipButton={true}>
        <Kb.ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          key={
            props.errorMessage || 'scroll' /* if we get an error redraw entirely so we're not scrolled down */
          }
        >
          <Kb.Box2
            direction="vertical"
            gap="small"
            onCopyCapture={e => {
              // disallow copying the whole screen by accident
              e.preventDefault()
              proofText && props.copyToClipboard(proofText)
            }}
          >
            {!!props.errorMessage && (
              <Kb.Box2 direction="vertical" fullWidth={true} style={styles.error}>
                <Kb.Text center={true} negative={true} type="BodySemibold">
                  {props.errorMessage}
                </Kb.Text>
              </Kb.Box2>
            )}
            <Kb.PlatformIcon
              platform={props.platform}
              style={styles.center}
              overlay="icon-proof-unfinished"
              overlayColor={Kb.Styles.globalColors.greyDark}
            />
            <>
              <Kb.Text center={true} style={styles.blue} type="Header">
                {props.platformUserName}
              </Kb.Text>
              {!!platformSubtitle && (
                <Kb.Text center={true} style={styles.grey} type="Body">
                  {platformSubtitle}
                </Kb.Text>
              )}
            </>
            {DescriptionView && <DescriptionView platformUserName={props.platformUserName} />}
            {!!proofText && <Kb.CopyableText style={styles.proof} value={proofText} />}
            {!!noteText && (
              <Kb.Text center={true} type="Body">
                {noteText}
              </Kb.Text>
            )}
            <Kb.Box2 direction={Kb.Styles.isMobile ? 'verticalReverse' : 'horizontal'} gap="small">
              <Kb.Button type="Dim" onClick={props.onCancel} label="Cancel" />
              {this.state.showSubmit ? (
                <Kb.WaitingButton
                  onClick={props.onSubmit}
                  label={onCompleteText || ''}
                  waitingKey={C.Profile.waitingKey}
                />
              ) : (
                <Kb.Button
                  onClick={() => {
                    this.setState({showSubmit: true})
                    props.url && openUrl(props.url)
                  }}
                  label={proofActionText || ''}
                />
              )}
            </Kb.Box2>
          </Kb.Box2>
        </Kb.ScrollView>
      </Modal>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  blue: {color: Kb.Styles.globalColors.blueDark},
  center: {alignSelf: 'center'},
  error: {
    alignSelf: 'center',
    backgroundColor: Kb.Styles.globalColors.red,
    borderRadius: Kb.Styles.borderRadius,
    padding: Kb.Styles.globalMargins.medium,
  },
  grey: {color: Kb.Styles.globalColors.black_20},
  proof: {
    flexGrow: 1,
    minHeight: 116,
  },
  scroll: {width: '100%'},
  scrollContent: {width: '100%'},
}))

export default PostProof
