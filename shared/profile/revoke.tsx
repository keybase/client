import * as C from '@/constants'
import {useProfileState} from '@/stores/profile'
import * as Kb from '@/common-adapters'
import capitalize from 'lodash/capitalize'
import {subtitle as platformSubtitle} from '@/util/platforms'
import {SiteIcon} from './generic/shared'
import type * as T from '@/constants/types'
import Modal from './modal'

type OwnProps = {
  icon: T.Tracker.SiteIconSet
  platform: T.More.PlatformsExpandedType
  platformHandle: string
  proofId: string
}
const RevokeProof = (ownProps: OwnProps) => {
  const {platformHandle, platform, proofId, icon} = ownProps
  const errorMessage = useProfileState(s => s.revokeError)
  const finishRevoking = useProfileState(s => s.dispatch.finishRevoking)
  const submitRevokeProof = useProfileState(s => s.dispatch.submitRevokeProof)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onCancel = () => {
    finishRevoking()
    clearModals()
  }
  const onRevoke = () => {
    proofId && submitRevokeProof(proofId)
    clearModals()
  }

  const platformHandleSubtitle = platformSubtitle(platform)
  return (
    <Modal onCancel={onCancel} skipButton={true}>
      {!!errorMessage && (
        <Kb.Box style={styles.errorBanner}>
          <Kb.Text center={!Kb.Styles.isMobile} style={styles.errorBannerText} type="BodySemibold">
            {errorMessage}
          </Kb.Text>
        </Kb.Box>
      )}
      <Kb.Box style={styles.contentContainer}>
        <Kb.Box style={styles.positionRelative}>
          <SiteIcon set={icon} full={true} style={styles.siteIcon} />
          <Kb.Icon type="icon-proof-broken" style={styles.revokeIcon} />
        </Kb.Box>
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
      </Kb.Box>
    </Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      contentContainer: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        flexGrow: 1,
        justifyContent: 'center',
        margin: Kb.Styles.isMobile ? Kb.Styles.globalMargins.tiny : Kb.Styles.globalMargins.large,
        maxWidth: 512,
        textAlign: Kb.Styles.isMobile ? undefined : 'center',
      },
      descriptionText: {marginTop: Kb.Styles.globalMargins.medium},
      errorBanner: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.red,
        justifyContent: 'center',
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
      positionRelative: {position: 'relative'},
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
