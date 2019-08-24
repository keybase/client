import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/profile'
import {capitalize} from 'lodash-es'
import {subtitle as platformSubtitle} from '../../util/platforms'
import {SiteIcon} from '../generic/shared'
import {PlatformsExpandedType} from '../../constants/types/more'
import {SiteIconSet} from '../../constants/types/tracker2'
import Modal from '../modal'

type Props = {
  icon: SiteIconSet
  platform: PlatformsExpandedType
  platformHandle: string
  errorMessage?: string | null
  onCancel: () => void
  onRevoke: () => void
  isWaiting: boolean
}

const Revoke = (props: Props) => {
  const platformHandleSubtitle = platformSubtitle(props.platform)
  return (
    <Modal onCancel={props.onCancel} skipButton={true}>
      {!!props.errorMessage && (
        <Kb.Box style={styles.errorBanner}>
          <Kb.Text center={!Styles.isMobile} style={styles.errorBannerText} type="BodySemibold">
            {props.errorMessage}
          </Kb.Text>
        </Kb.Box>
      )}
      <Kb.Box style={styles.contentContainer}>
        <Kb.Box style={styles.positionRelative}>
          <SiteIcon set={props.icon} full={true} style={styles.siteIcon} />
          <Kb.Icon type="icon-proof-broken" style={styles.revokeIcon} />
        </Kb.Box>
        <Kb.Text center={!Styles.isMobile} style={styles.platformUsername} type="Header">
          {props.platformHandle}
        </Kb.Text>
        {!!platformHandleSubtitle && (
          <Kb.Text style={styles.platformSubtitle} type="Body">
            {platformHandleSubtitle}
          </Kb.Text>
        )}
        <Kb.Text center={!Styles.isMobile} style={styles.descriptionText} type="Header">
          {formatMessage(props.platform)}
        </Kb.Text>
        <Kb.Text center={!Styles.isMobile} style={styles.reminderText} type="Body">
          You can add it again later, if you change your mind.
        </Kb.Text>
        <Kb.ButtonBar>
          <Kb.WaitingButton
            type="Dim"
            onClick={props.onCancel}
            label="Cancel"
            waitingKey={Constants.waitingKey}
          />
          <Kb.WaitingButton
            type="Danger"
            onClick={props.onRevoke}
            label={props.platform === 'pgp' ? 'Yes, drop it' : 'Yes, revoke it'}
            waitingKey={Constants.waitingKey}
          />
        </Kb.ButtonBar>
      </Kb.Box>
    </Modal>
  )
}

const styles = Styles.styleSheetCreate({
  contentContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    margin: Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.large,
    maxWidth: 512,
    ...(Styles.isMobile ? {} : {textAlign: 'center'}),
  },
  descriptionText: {marginTop: Styles.globalMargins.medium},
  errorBanner: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.red,
    justifyContent: 'center',
    minHeight: Styles.globalMargins.large,
    padding: Styles.globalMargins.tiny,
    width: '100%',
  },
  errorBannerText: {
    color: Styles.globalColors.white,
    maxWidth: 512,
  },
  platformSubtitle: {
    color: Styles.globalColors.black_20,
  },
  platformUsername: Styles.platformStyles({
    common: {
      color: Styles.globalColors.redDark,
      textDecorationLine: 'line-through',
    },
    isElectron: {
      maxWidth: 400,
      overflowWrap: 'break-word',
    },
  }),
  positionRelative: {position: 'relative'},
  reminderText: {marginTop: Styles.globalMargins.tiny},
  revokeIcon: {bottom: -8, position: 'absolute', right: -10},
  siteIcon: Styles.isMobile ? {height: 64, width: 64} : {height: 48, width: 48},
})

function formatMessage(platform: PlatformsExpandedType) {
  if (platform === 'pgp') {
    return 'Are you sure you want to drop your PGP key'
  }
  let body
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

export default Revoke
