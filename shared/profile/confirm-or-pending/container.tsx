import * as C from '@/constants'
import * as T from '@/constants/types'
import {globalColors} from '@/styles'
import * as Kb from '@/common-adapters'
import {subtitle} from '@/util/platforms'
import Modal from '../modal'

const Container = () => {
  const proofFound = C.useProfileState(s => s.proofFound)
  const proofStatus = C.useProfileState(s => s.proofStatus)
  const platform = C.useProfileState(s => s.platform)
  const username = C.useProfileState(s => s.username)
  const backToProfile = C.useProfileState(s => s.dispatch.backToProfile)

  const isGood = proofFound && proofStatus === T.RPCGen.ProofStatus.ok
  const isPending =
    !isGood && !proofFound && !!proofStatus && proofStatus <= T.RPCGen.ProofStatus.baseHardError

  if (!platform) {
    throw new Error('No platform passed to confirm or pending container')
  }

  const platformIconOverlayColor = isGood ? globalColors.green : globalColors.greyDark
  const onCancel = backToProfile

  const message =
    messageMap.get(platform) ||
    (isPending
      ? 'Some proofs can take a few hours to recognize. Check back later.'
      : 'Leave your proof up so other users can identify you!')
  const platformIconOverlay = isPending ? 'icon-proof-pending' : 'icon-proof-success'
  const platformSubtitle = subtitle(platform)
  const title = isPending ? 'Your proof is pending.' : 'Verified!'

  return (
    <Modal onCancel={onCancel} skipButton={true}>
      <Kb.Box2 direction="vertical" gap="small">
        <Kb.Text negative={true} type="BodySemibold">
          {title}
        </Kb.Text>
        <Kb.PlatformIcon
          style={styles.center}
          platform={platform}
          overlay={platformIconOverlay}
          overlayColor={platformIconOverlayColor}
        />
        <>
          <Kb.Text center={true} type="Header" style={styles.blue}>
            {username}
          </Kb.Text>
          {platformSubtitle && (
            <Kb.Text center={true} type="Body" style={styles.grey}>
              {platformSubtitle}
            </Kb.Text>
          )}
        </>
        <>
          <Kb.Text center={true} type="Body">
            {message}
          </Kb.Text>
          {platform === 'http' && (
            <Kb.Text center={true} type="BodySmall">
              Note: {username} doesn&apos;t load over https. If you get a real SSL certificate (not
              self-signed) in the future, please replace this proof with a fresh one.
            </Kb.Text>
          )}
        </>
        <Kb.Button onClick={onCancel} label="Reload profile" />
      </Kb.Box2>
    </Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  blue: Kb.Styles.platformStyles({
    common: {color: Kb.Styles.globalColors.blueDark},
    isElectron: {wordBreak: 'break-all'},
  }),
  center: {alignSelf: 'center'},
  grey: {color: Kb.Styles.globalColors.black_20},
}))

const messageMap = new Map([
  ['btc', 'Your Bitcoin address has now been signed onto your profile.'],
  ['dns', 'DNS proofs can take a few hours to recognize. Check back later.'],
  [
    'hackernews',
    'Hacker News caches its bios, so it might be a few hours before you can verify your proof. Check back later.',
  ],
  ['zcash', 'Your Zcash address has now been signed onto your profile.'],
])

export default Container
