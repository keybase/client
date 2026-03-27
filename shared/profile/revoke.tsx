import * as C from '@/constants'
import {useProfileState} from '@/stores/profile'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import capitalize from 'lodash/capitalize'
import {subtitle as platformSubtitle} from '@/util/platforms'
import {SiteIcon} from './generic/shared'
import * as T from '@/constants/types'
import Modal from './modal'
import {useCurrentUserState} from '@/stores/current-user'
import {useTrackerState} from '@/stores/tracker'
import {generateGUIID} from '@/constants/utils'

type OwnProps = {
  icon: T.Tracker.SiteIconSet
  platform: T.More.PlatformsExpandedType
  platformHandle: string
  proofId: string
}
const RevokeProof = (ownProps: OwnProps) => {
  const {platformHandle, platform, proofId, icon} = ownProps
  const [errorMessage, setErrorMessage] = React.useState('')
  const currentUsername = useCurrentUserState(s => s.username)
  const assertions = useTrackerState(s => s.getDetails(currentUsername).assertions)
  const loadProfile = useTrackerState(s => s.dispatch.load)
  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)
  const revokeKey = C.useRPC(T.RPCGen.revokeRevokeKeyRpcPromise)
  const revokeSigs = C.useRPC(T.RPCGen.revokeRevokeSigsRpcPromise)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const proof = assertions ? [...assertions.values()].find(a => a.sigID === proofId) : undefined
  const onSuccess = () => {
    showUserProfile(currentUsername)
    loadProfile({assertion: currentUsername, guiID: generateGUIID(), inTracker: false, reason: ''})
    clearModals()
  }
  const onCancel = () => {
    clearModals()
  }
  const onRevoke = () => {
    if (!proofId || !proof) {
      clearModals()
      return
    }
    if (proof.type === 'pgp') {
      revokeKey([{keyID: proof.kid}, C.waitingKeyProfile], onSuccess, error => {
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
    <Modal onCancel={onCancel} skipButton={true}>
      {!!errorMessage && (
        <Kb.Box2
          direction="vertical"
          alignItems="center"
          fullWidth={true}
          justifyContent="center"
          style={styles.errorBanner}
        >
          <Kb.Text center={!Kb.Styles.isMobile} style={styles.errorBannerText} type="BodySemibold">
            {errorMessage}
          </Kb.Text>
        </Kb.Box2>
      )}
      <Kb.Box2 direction="vertical" centerChildren={true} flex={1} style={styles.contentContainer}>
        <Kb.Box2 direction="vertical" relative={true}>
          <SiteIcon set={icon} full={true} style={styles.siteIcon} />
          <Kb.ImageIcon type="icon-proof-broken" style={styles.revokeIcon} />
        </Kb.Box2>
        <Kb.Text center={!Kb.Styles.isMobile} style={styles.platformUsername} type="Header">
          {platformHandle}
        </Kb.Text>
        {!!platformHandleSubtitle && (
          <Kb.Text style={styles.platformSubtitle} type="Body">
            {platformHandleSubtitle}
          </Kb.Text>
        )}
        <Kb.Text center={!Kb.Styles.isMobile} style={styles.descriptionText} type="Header">
          {formatMessage(platform)}
        </Kb.Text>
        <Kb.Text center={!Kb.Styles.isMobile} style={styles.reminderText} type="Body">
          You can add it again later, if you change your mind.
        </Kb.Text>
        <Kb.ButtonBar>
          <Kb.WaitingButton type="Dim" onClick={onCancel} label="Cancel" waitingKey={C.waitingKeyProfile} />
          <Kb.WaitingButton
            type="Danger"
            onClick={onRevoke}
            label={platform === 'pgp' ? 'Yes, drop it' : 'Yes, revoke it'}
            waitingKey={C.waitingKeyProfile}
          />
        </Kb.ButtonBar>
      </Kb.Box2>
    </Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      contentContainer: {
        margin: Kb.Styles.isMobile ? Kb.Styles.globalMargins.tiny : Kb.Styles.globalMargins.large,
        maxWidth: 512,
        textAlign: Kb.Styles.isMobile ? undefined : 'center',
      },
      descriptionText: {marginTop: Kb.Styles.globalMargins.medium},
      errorBanner: {
        backgroundColor: Kb.Styles.globalColors.red,
        minHeight: Kb.Styles.globalMargins.large,
        padding: Kb.Styles.globalMargins.tiny,
        width: '100%',
      },
      errorBannerText: {
        color: Kb.Styles.globalColors.white,
        maxWidth: 512,
      },
      platformSubtitle: {
        color: Kb.Styles.globalColors.black_20,
      },
      platformUsername: Kb.Styles.platformStyles({
        common: {
          color: Kb.Styles.globalColors.redDark,
          textDecorationLine: 'line-through',
        },
        isElectron: {
          maxWidth: 400,
          overflowWrap: 'break-word',
        },
      }),
      reminderText: {marginTop: Kb.Styles.globalMargins.tiny},
      revokeIcon: {bottom: -8, position: 'absolute', right: -10},
      siteIcon: Kb.Styles.isMobile ? {height: 64, width: 64} : {height: 48, width: 48},
    }) as const
)

function formatMessage(platform: T.More.PlatformsExpandedType) {
  if (platform === 'pgp') {
    return 'Are you sure you want to drop your PGP key'
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
