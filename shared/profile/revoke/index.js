// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/profile'
import {capitalize} from 'lodash-es'
import {subtitle as platformSubtitle} from '../../util/platforms'
import {SiteIcon} from '../generic/shared'
import type {PlatformsExpandedType} from '../../constants/types/more'
import type {SiteIconSet} from '../../constants/types/tracker2'
import Modal from '../modal'

type Props = {|
  icon: SiteIconSet,
  platform: PlatformsExpandedType,
  platformHandle: string,
  errorMessage?: ?string,
  onCancel: () => void,
  onRevoke: () => void,
  isWaiting: boolean,
|}

const Revoke = (props: Props) => {
  const platformHandleSubtitle = platformSubtitle(props.platform)
  return (
    <Modal onCancel={props.onCancel} skipButton={true}>
      {!!props.errorMessage && (
        <Kb.Box style={styleErrorBanner}>
          <Kb.Text center={!Styles.isMobile} style={styleErrorBannerText} type="BodySemibold">
            {props.errorMessage}
          </Kb.Text>
        </Kb.Box>
      )}
      <Kb.Box style={styleContentContainer}>
        <Kb.Box style={stylePositionRelative}>
          <SiteIcon set={props.icon} full={true} style={styleSiteIcon} />
          <Kb.Icon type="icon-proof-broken" style={styleRevokeIcon} />
        </Kb.Box>
        <Kb.Text center={!Styles.isMobile} style={stylePlatformUsername} type="Header">
          {props.platformHandle}
        </Kb.Text>
        {!!platformHandleSubtitle && (
          <Kb.Text style={stylePlatformSubtitle} type="Body">
            {platformHandleSubtitle}
          </Kb.Text>
        )}
        <Kb.Text center={!Styles.isMobile} style={styleDescriptionText} type="Header">
          {formatMessage(props.platform)}
        </Kb.Text>
        <Kb.Text center={!Styles.isMobile} style={styleReminderText} type="Body">
          You can add it again later, if you change your mind.
        </Kb.Text>
        <Kb.ButtonBar>
          <Kb.WaitingButton
            type="Secondary"
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

const styleErrorBanner = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: Styles.globalColors.red,
  justifyContent: 'center',
  minHeight: Styles.globalMargins.large,
  padding: Styles.globalMargins.tiny,
  width: '100%',
}

const styleErrorBannerText = {
  color: Styles.globalColors.white,
  maxWidth: 512,
}

const styleContentContainer = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  flexGrow: 1,
  justifyContent: 'center',
  margin: Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.large,
  maxWidth: 512,
  ...(Styles.isMobile ? {} : {textAlign: 'center'}),
}

const stylePlatformUsername = Styles.platformStyles({
  common: {
    color: Styles.globalColors.red,
    textDecorationLine: 'line-through',
  },
  isElectron: {
    maxWidth: 400,
    overflowWrap: 'break-word',
  },
})
const stylePlatformSubtitle = {
  color: Styles.globalColors.black_20,
}
const styleDescriptionText = {marginTop: Styles.globalMargins.medium}
const styleReminderText = {marginTop: Styles.globalMargins.tiny}
const stylePositionRelative = {position: 'relative'}
const styleRevokeIcon = {bottom: -8, position: 'absolute', right: -10}
const styleSiteIcon = Styles.isMobile ? {height: 64, width: 64} : {height: 48, width: 48}

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
    case 'pgp':
      body = 'PGP key'
      break
    default:
      body = `${capitalize(platform)} identity`
  }
  return `Are you sure you want to revoke your ${body}?`
}

export default Revoke
