import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import capitalize from 'lodash/capitalize'
import {subtitle as platformSubtitle} from '@/util/platforms'
import {SiteIcon} from './generic/site-icon'
import * as T from '@/constants/types'
import {useCurrentUserState} from '@/stores/current-user'
import {navToProfile} from '@/constants/router'

type OwnProps = {
  icon: T.Tracker.SiteIconSet
  kid?: string
  platform: T.More.PlatformsExpandedType
  platformHandle: string
  proofId: string
}
const RevokeProof = (ownProps: OwnProps) => {
  const styles = useStyles()
  const {icon, kid, platform, platformHandle, proofId} = ownProps
  const [errorMessage, setErrorMessage] = React.useState('')
  const currentUsername = useCurrentUserState(s => s.username)
  const revokeKey = C.useRPC(T.RPCGen.revokeRevokeKeyRpcPromise)
  const revokeSigs = C.useRPC(T.RPCGen.revokeRevokeSigsRpcPromise)
  const clearModals = C.Router2.clearModals
  const onSuccess = () => {
    navToProfile(currentUsername)
    clearModals()
  }
  const onCancel = () => {
    clearModals()
  }
  const onRevoke = () => {
    if (!proofId) {
      clearModals()
      return
    }
    if (platform === 'pgp') {
      if (!kid) {
        setErrorMessage('This PGP key cannot be dropped because its key ID is missing.')
        return
      }
      revokeKey([{keyID: kid}, C.waitingKeyProfile], onSuccess, error => {
        setErrorMessage(`Error in dropping Pgp Key: ${error.message}`)
      })
      return
    }
    revokeSigs([{sigIDQueries: [proofId]}, C.waitingKeyProfile], onSuccess, () => {
      setErrorMessage('There was an error revoking your proof. You can click the button to try again.')
    })
  }

  const platformHandleSubtitle = platformSubtitle(platform)
  return (
    <Kb.ModalScreen
      centered={true}
      banner={
        errorMessage ? (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={errorMessage} />
          </Kb.Banner>
        ) : undefined
      }
      footer={
        <Kb.ConfirmButtons
          split={true}
          waitingKey={C.waitingKeyProfile}
          onCancel={onCancel}
          onConfirm={onRevoke}
          confirmLabel={platform === 'pgp' ? 'Yes, drop it' : 'Yes, revoke it'}
          confirmType="Danger"
        />
      }
    >
      <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={styles.container}>
        <Kb.Box2 direction="vertical" relative={true}>
          <SiteIcon set={icon} full={true} style={styles.siteIcon} />
          <Kb.ImageIcon type="icon-proof-broken" style={styles.revokeIcon} />
        </Kb.Box2>
        <Kb.Text center={true} style={styles.platformUsername} type="BodyBig">
          {platformHandle}
        </Kb.Text>
        {!!platformHandleSubtitle && (
          <Kb.Text style={styles.platformSubtitle} type="Body">
            {platformHandleSubtitle}
          </Kb.Text>
        )}
        <Kb.Text center={true} style={styles.descriptionText} type="BodyBig">
          {formatMessage(platform)}
        </Kb.Text>
        <Kb.Text center={true} style={styles.reminderText} type="Body">
          You can add it again later, if you change your mind.
        </Kb.Text>
      </Kb.Box2>
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      container: {paddingTop: Kb.Styles.globalMargins.small},
      descriptionText: {marginTop: Kb.Styles.globalMargins.medium},
      platformSubtitle: {
        color: theme.black_20,
      },
      platformUsername: Kb.Styles.platformStyles({
        common: {
          color: theme.redDark,
          marginTop: Kb.Styles.globalMargins.small,
          textDecorationLine: 'line-through',
        },
        isElectron: {
          overflowWrap: 'anywhere',
        },
      }),
      reminderText: {marginTop: Kb.Styles.globalMargins.tiny},
      revokeIcon: {bottom: -8, position: 'absolute', right: -10},
      siteIcon: isMobile ? Kb.Styles.size(64) : Kb.Styles.size(48),
    }) as const
)

export function formatMessage(platform: T.More.PlatformsExpandedType) {
  if (platform === 'pgp') {
    return 'Are you sure you want to drop your PGP key?'
  }
  let body: string
  switch (platform) {
    case 'btc':
      body = 'Bitcoin address'
      break
    case 'dns':
    case 'http':
    case 'https':
    case 'web':
      body = 'website'
      break
    case 'hackernews':
      body = 'Hacker News identity'
      break
    default:
      body = `${capitalize(platform)} identity`
  }
  return `Are you sure you want to revoke your ${body}?`
}

export default RevokeProof
