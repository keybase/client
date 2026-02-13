import * as C from '@/constants'
import {useProfileState} from '@/stores/profile'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {subtitle} from '@/util/platforms'
import openUrl from '@/util/open-url'
import Modal from './modal'
import {useConfigState} from '@/stores/config'

const Container = () => {
  const platform = useProfileState(s => s.platform)
  const errorText = useProfileState(s => s.errorText)
  const username = useProfileState(s => s.username)
  let proofText = useProfileState(s => s.proofText)
  const cancelAddProof = useProfileState(s => s.dispatch.dynamic.cancelAddProof)
  const checkProof = useProfileState(s => s.dispatch.checkProof)
  if (
    !platform ||
    platform === 'zcash' ||
    platform === 'btc' ||
    platform === 'dnsOrGenericWebSite' ||
    platform === 'pgp'
  ) {
    throw new Error(`Invalid profile platform in PostProofContainer: ${platform || ''}`)
  }

  let url = ''
  let openLinkBeforeSubmit = false
  switch (platform) {
    case 'twitter':
      openLinkBeforeSubmit = true
      url = proofText ? `https://twitter.com/home?status=${proofText || ''}` : ''
      break
    case 'github':
      openLinkBeforeSubmit = true
      url = 'https://gist.github.com/'
      break
    case 'reddit': // fallthrough
    case 'facebook':
      openLinkBeforeSubmit = true
      url = proofText ? proofText : ''
      proofText = ''
      break
    case 'hackernews':
      openLinkBeforeSubmit = true
      url = `https://news.ycombinator.com/user?id=${username || ''}`
      break
    default:
      break
  }
  const platformUserName = username
  const copyToClipboard = useConfigState(s => s.dispatch.defer.copyToClipboard)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onCancel = () => {
    clearModals()
    cancelAddProof?.()
  }
  const onSubmit = checkProof
  const errorMessage = errorText
  const [showSubmit, setShowSubmit] = React.useState(!openLinkBeforeSubmit)
  const platformSubtitle = subtitle(platform)
  const proofActionText = actionMap.get(platform) ?? ''
  const onCompleteText = checkMap.get(platform) ?? 'OK posted! Check for it!'
  const noteText = noteMap.get(platform) ?? ''
  const DescriptionView = descriptionMap[platform]
  return (
    <Modal onCancel={onCancel} skipButton={true}>
      <Kb.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        key={
          errorMessage || 'scroll'
          /* if we get an error redraw entirely so we're not scrolled down */
        }
      >
        <Kb.Box2
          direction="vertical"
          gap="small"
          onCopyCapture={e => {
            e.preventDefault()
            proofText && copyToClipboard(proofText)
          }}
        >
          {!!errorMessage && (
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.error}>
              <Kb.Text center={true} negative={true} type="BodySemibold">
                {errorMessage}
              </Kb.Text>
            </Kb.Box2>
          )}
          <Kb.PlatformIcon
            platform={platform}
            style={styles.center}
            overlay="icon-proof-unfinished"
            overlayColor={Kb.Styles.globalColors.greyDark}
          />
          <>
            <Kb.Text center={true} style={styles.blue} type="Header">
              {platformUserName}
            </Kb.Text>
            {!!platformSubtitle && (
              <Kb.Text center={true} style={styles.grey} type="Body">
                {platformSubtitle}
              </Kb.Text>
            )}
          </>
          <DescriptionView platformUserName={platformUserName} />
          {!!proofText && <Kb.CopyableText style={styles.proof} value={proofText} />}
          {!!noteText && (
            <Kb.Text center={true} type="Body">
              {noteText}
            </Kb.Text>
          )}
          <Kb.Box2 direction={Kb.Styles.isMobile ? 'verticalReverse' : 'horizontal'} gap="small">
            <Kb.Button type="Dim" onClick={onCancel} label="Cancel" />
            {showSubmit ? (
              <Kb.WaitingButton
                onClick={onSubmit}
                label={onCompleteText || ''}
                waitingKey={C.waitingKeyProfile}
              />
            ) : (
              <Kb.Button
                onClick={() => {
                  setShowSubmit(true)
                  url && openUrl(url)
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
        Please serve the text below <Kb.Text type="BodySemiboldItalic">exactly as it appears</Kb.Text>
        {" at one of these URL's."}
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

const descriptionMap = {
  dns: () => (
    <Kb.Text center={true} type="BodySemibold">
      Enter the following as a TXT entry in your DNS zone,{' '}
      <Kb.Text type="BodySemibold">exactly as it appears</Kb.Text>
      {'. If you need a "name" for your entry, give it "@".'}
    </Kb.Text>
  ),
  facebook: () => null,
  github: () => (
    <Kb.Text center={true} type="BodySemibold">
      Login to GitHub and paste the text below into a <Kb.Text type="BodySemiboldItalic">public</Kb.Text> gist
      called <Kb.Text type="BodySemiboldItalic">keybase.md.</Kb.Text>
    </Kb.Text>
  ),
  hackernews: () => (
    <Kb.Text center={true} type="BodySemibold">
      Please add the below text{' '}
      <Kb.Text type="BodySemibold" style={{...Kb.Styles.globalStyles.italic}}>
        exactly as it appears
      </Kb.Text>{' '}
      to your profile.
    </Kb.Text>
  ),
  http: WebDescription,
  https: WebDescription,
  reddit: () => (
    <Kb.Text center={true} type="BodySemibold">
      Click the button below and post the form in the subreddit{' '}
      <Kb.Text type="BodySemiboldItalic">KeybaseProofs</Kb.Text>.
    </Kb.Text>
  ),
  rooter: () => null,
  twitter: () => (
    <Kb.Text center={true} type="BodySemibold">
      Please tweet the text below{' '}
      <Kb.Text type="BodySemiboldItalic" style={{...Kb.Styles.globalStyles.italic}}>
        exactly as it appears.
      </Kb.Text>
    </Kb.Text>
  ),
  web: WebDescription,
} as const

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

export default Container
