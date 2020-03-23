import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import InviteHow from './invite-how'

const InviteFriends = () => {
  const inviteCounts = Container.useSelector(state => state.people.inviteCounts)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onInviteFriends = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{selected: 'inviteFriendsModal'}]}))

  const {popup, toggleShowingPopup, showingPopup} = Kb.usePopup(() => (
    <InviteHow visible={showingPopup} onHidden={toggleShowingPopup} />
  ))
  const inviteButton = (
    <Kb.Button
      small={true}
      label="Invite friends"
      onClick={Styles.isMobile ? toggleShowingPopup : onInviteFriends}
    />
  )

  let inviteCounter: React.ReactNode = null
  let firstTooltipLine = ''
  if (inviteCounts) {
    inviteCounter = (
      <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true}>
        <Kb.Icon type="iconfont-envelope" sizeType="Small" color={Styles.globalColors.blueDarkerOrBlack_85} />
        <Kb.Text type="BodySmallBold" style={styles.counter}>
          {inviteCounts.inviteCount.toLocaleString()}{' '}
          {inviteCounts.showFire ? <Kb.Emoji emojiName="fire" size={12} /> : null}
        </Kb.Text>
      </Kb.Box2>
    )
    firstTooltipLine = `${inviteCounts.inviteCount.toLocaleString()} friends invited in the last 24 hours.`
  }

  return Styles.isMobile ? (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.mobileContainer}>
      <Kb.Box style={Styles.globalStyles.flexOne} />
      {inviteButton}
      {inviteCounter ? (
        <Kb.Box2 direction="horizontal" style={styles.inviteCounterBox}>
          <Kb.WithTooltip tooltip={firstTooltipLine} showOnPressMobile={true}>
            {inviteCounter}
          </Kb.WithTooltip>
        </Kb.Box2>
      ) : (
        // Needed to center button even if inviteCounts isn't loaded yet
        <Kb.Box style={Styles.globalStyles.flexOne} />
      )}
      {popup}
    </Kb.Box2>
  ) : (
    <>
      <Kb.Box style={Styles.globalStyles.flexOne} />
      <Kb.Divider />
      <Kb.Box2 direction="vertical" gap="xsmall" style={styles.container} className="invite-friends-big">
        {inviteButton}
        {!!inviteCounts && (
          <Kb.WithTooltip
            tooltip={
              <Kb.Box2 direction="vertical" alignItems="flex-start">
                <Kb.Text type="BodySmall" style={styles.tooltip}>
                  {firstTooltipLine}
                </Kb.Text>
                {inviteCounts.percentageChange > 0 ? (
                  <Kb.Text type="BodySmall" style={styles.tooltip}>
                    That's {inviteCounts.percentageChange}% more than yesterday.
                  </Kb.Text>
                ) : null}
                {inviteCounts.showFire ? (
                  <Kb.Text type="BodySmall" style={styles.tooltip}>
                    Keybase servers are on fire! <Kb.Emoji emojiName="fire" size={12} />
                  </Kb.Text>
                ) : null}
              </Kb.Box2>
            }
          >
            {inviteCounter}
          </Kb.WithTooltip>
        )}
      </Kb.Box2>
      <Kb.ClickableBox
        style={styles.bigEnvelopeIcon}
        className="invite-friends-little"
        onClick={onInviteFriends}
      >
        <Kb.WithTooltip tooltip="Invite friends" position="top center">
          <Kb.Icon
            type="iconfont-envelope"
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
