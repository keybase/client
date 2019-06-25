import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {subtitle} from '../../util/platforms'
import Modal from '../modal'
import {PlatformsExpandedType} from '../../constants/types/more'

type Props = {
  platform: PlatformsExpandedType
  isPending: boolean
  platformIconOverlayColor: string
  username: string
  onCancel: () => void
}

const ConfirmOrPending = (props: Props) => {
  const message =
    messageMap[props.platform] ||
    (props.isPending
      ? 'Some proofs can take a few hours to recognize. Check back later.'
      : 'Leave your proof up so other users can identify you!')
  const platformIconOverlay = props.isPending ? 'icon-proof-pending' : 'icon-proof-success'
  const platformSubtitle = subtitle(props.platform)
  const title = props.isPending ? 'Your proof is pending.' : 'Verified!'

  return (
    <Modal onCancel={props.onCancel} skipButton={true}>
      <Kb.Box2 direction="vertical" gap="small">
        <Kb.Text negative={true} type="BodySemibold">
          {title}
        </Kb.Text>
        <Kb.PlatformIcon
          style={styles.center}
          platform={props.platform}
          overlay={platformIconOverlay}
          overlayColor={props.platformIconOverlayColor}
        />
        <>
          <Kb.Text center={true} type="Header" style={styles.blue}>
            {props.username}
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
          {props.platform === 'http' && (
            <Kb.Text center={true} type="BodySmall">
              Note: {props.username} doesn't load over https. If you get a real SSL certificate (not
              self-signed) in the future, please replace this proof with a fresh one.
            </Kb.Text>
          )}
        </>
        <Kb.Button onClick={props.onCancel} label="Reload profile" />
      </Kb.Box2>
    </Modal>
  )
}

const styles = Styles.styleSheetCreate({
  blue: {color: Styles.globalColors.blueDark},
  center: {alignSelf: 'center'},
  grey: {color: Styles.globalColors.black_20},
})

const messageMap: {[K in string]: string | null} = {
  btc: 'Your Bitcoin address has now been signed onto your profile.',
  dns: 'DNS proofs can take a few hours to recognize. Check back later.',
  hackernews:
    'Hacker News caches its bios, so it might be a few hours before you can verify your proof. Check back later.',
  zcash: 'Your Zcash address has now been signed onto your profile.',
}

export default ConfirmOrPending
