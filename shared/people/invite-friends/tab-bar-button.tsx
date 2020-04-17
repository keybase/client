import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RPCTypes from '../../constants/types/rpc-gen'
import logger from '../../logger'
import InviteHow from './invite-how'
import {ShareLinkPopup} from './modal'

const InviteFriends = () => {
  const requestInviteCounts = Container.useRPC(RPCTypes.inviteFriendsRequestInviteCountsRpcPromise)
  const inviteCounts = Container.useSelector(state => state.people.inviteCounts)
  const inviteCountsLoaded = !!inviteCounts
  React.useEffect(() => {
    if (inviteCountsLoaded) return
    requestInviteCounts(
      [undefined],
      _ => {},
      err => logger.error(err.message)
    )
  }, [inviteCountsLoaded, requestInviteCounts])

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onInviteFriends = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{selected: 'inviteFriendsModal'}]}))

  const {popup: shareLinkPopup, setShowingPopup: setShowingShareLinkPopup} = Kb.usePopup(() => (
    <ShareLinkPopup onClose={() => setShowingShareLinkPopup(false)} />
  ))

  const {popup, toggleShowingPopup, showingPopup} = Kb.usePopup(() => (
    <InviteHow
      visible={showingPopup}
      onHidden={toggleShowingPopup}
      onShareLink={() => setShowingShareLinkPopup(true)}
    />
  ))
  const inviteButton = (
    <Kb.Button
      small={true}
      label="Invite friends"
      onClick={Styles.isMobile ? toggleShowingPopup : onInviteFriends}
    />
  )

  let inviteCounter: React.ReactNode = null
  if (inviteCounts?.showNumInvites) {
    inviteCounter = (
      <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true}>
        <Kb.Icon
          type="iconfont-envelope-solid"
          sizeType="Small"
          color={Styles.globalColors.blueDarkerOrBlack_85}
        />
        <Kb.Text type="BodySmallBold" style={styles.counter}>
          {inviteCounts.inviteCount.toLocaleString()}{' '}
          {inviteCounts.showFire ? <Kb.Emoji emojiName=":fire:" size={12} /> : null}
        </Kb.Text>
      </Kb.Box2>
    )
  }
  const tooltipMarkdown = (
    <Kb.Markdown styleOverride={tooltipStyleOverride}>{inviteCounts?.tooltipMarkdown}</Kb.Markdown>
  )

  return Styles.isMobile ? (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.mobileContainer}>
      <Kb.Box style={Styles.globalStyles.flexOne} />
      {inviteButton}
      {inviteCounter ? (
        <Kb.Box2 direction="horizontal" style={styles.inviteCounterBox}>
          <Kb.WithTooltip tooltip={tooltipMarkdown} showOnPressMobile={true}>
            {inviteCounter}
          </Kb.WithTooltip>
        </Kb.Box2>
      ) : (
        // Needed to center button even if inviteCounts isn't loaded yet
        <Kb.Box style={Styles.globalStyles.flexOne} />
      )}
      {popup}
      {shareLinkPopup}
    </Kb.Box2>
  ) : (
    <>
      <Kb.Divider style={styles.goToBottom} />
      <Kb.Box2 direction="vertical" gap="xsmall" style={styles.container} className="invite-friends-big">
        {inviteButton}
        {!!inviteCounter && inviteCounts && (
          <Kb.WithTooltip tooltip={tooltipMarkdown}>{inviteCounter}</Kb.WithTooltip>
        )}
      </Kb.Box2>
      <Kb.ClickableBox
        style={styles.bigEnvelopeIcon}
        className="invite-friends-little"
        onClick={onInviteFriends}
      >
        <Kb.WithTooltip tooltip="Invite friends" position="top center">
          <Kb.Icon
            type="iconfont-envelope-solid"
            className="invite-icon"
            onClick={onInviteFriends}
            sizeType="Default"
          />
        </Kb.WithTooltip>
      </Kb.ClickableBox>
    </>
  )
}

export default InviteFriends

const styles = Styles.styleSheetCreate(() => ({
  bigEnvelopeIcon: {
    alignSelf: 'center',
    borderRadius: 4,
    margin: Styles.globalMargins.small,
    padding: 6,
  },
  container: {
    ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.medium),
  },
  counter: {
    color: Styles.globalColors.blueLighterOrBlack_50,
  },
  goToBottom: {marginTop: 'auto'},
  inviteCounterBox: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  mobileContainer: {
    backgroundColor: Styles.globalColors.blueDarkOrGreyDarkest,
    padding: Styles.globalMargins.xsmall,
  },
  tooltip: {
    color: Styles.globalColors.white,
  },
}))

const tooltipStyleOverride = {paragraph: styles.tooltip}
