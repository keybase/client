// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/profile'
import {formatMessage, formatConfirmButton} from './index.shared'
import {subtitle as platformSubtitle} from '../../util/platforms'
import type {Props} from './index'

const Revoke = (props: Props) => {
  const platformHandleSubtitle = platformSubtitle(props.platform)
  return (
    <Kb.Box style={styleContainer}>
      {!props.isWaiting && (
        <Kb.Icon
          style={styleClose}
          type="iconfont-close"
          onClick={props.onCancel}
          color={Styles.globalColors.black_10}
        />
      )}
      {!!props.errorMessage && (
        <Kb.Box style={styleErrorBanner}>
          <Kb.Text center={!Styles.isMobile} style={styleErrorBannerText} type="BodySemibold">
            {props.errorMessage}
          </Kb.Text>
        </Kb.Box>
      )}
      <Kb.Box style={styleContentContainer}>
        <Kb.PlatformIcon
          platform={props.platform}
          overlay={'icon-proof-broken'}
          overlayColor={Styles.globalColors.red}
        />
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
            label={formatConfirmButton(props.platform)}
            waitingKey={Constants.waitingKey}
          />
        </Kb.ButtonBar>
      </Kb.Box>
    </Kb.Box>
  )
}

const styleContainer = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  flexGrow: 1,
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
  minHeight: Styles.globalMargins.large,
  padding: Styles.globalMargins.tiny,
  width: '100%',
  zIndex: 1,
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
  margin: Styles.globalMargins.large,
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

export default Revoke
