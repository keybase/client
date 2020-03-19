import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'

const InviteFriends = () => {
  // TODO: useRPC to get this data
  const num = 1640
  const percentage = 154
  const showFire = true

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onInviteFriends = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{selected: 'inviteFriendsModal'}]}))

  const inviteButton = <Kb.Button small={true} label="Invite friends" onClick={onInviteFriends} />
  const inviteCounter = (
    <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true} style={styles.inviteCounterBox}>
      <Kb.Icon type="iconfont-envelope" sizeType="Small" color={Styles.globalColors.blueDarkerOrBlack_85} />
      <Kb.Text type="BodySmallBold" style={styles.counter}>
        {num.toLocaleString()} {showFire ? <Kb.Emoji emojiName="fire" size={12} /> : null}
      </Kb.Text>
    </Kb.Box2>
  )
  return Styles.isMobile ? (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.mobileContainer}>
      <Kb.Box style={Styles.globalStyles.flexOne} />
      {inviteButton}
      {inviteCounter}
    </Kb.Box2>
  ) : (
    <>
      <Kb.Box style={Styles.globalStyles.flexOne} />
      <Kb.Divider />
      <Kb.Box2 direction="vertical" gap="xsmall" style={styles.container} className="invite-friends-big">
        {inviteButton}
        <Kb.WithTooltip
          tooltip={
            <Kb.Box2 direction="vertical" alignItems="flex-start">
              <Kb.Text type="BodySmall" style={styles.tooltip}>
                {num.toLocaleString()} friends invited in the last 24 hours.
              </Kb.Text>
              {percentage > 0 ? (
                <Kb.Text type="BodySmall" style={styles.tooltip}>
                  That's {percentage}% more than yesterday.
                </Kb.Text>
              ) : null}
              {showFire ? (
                <Kb.Text type="BodySmall" style={styles.tooltip}>
                  Keybase servers are on fire! <Kb.Emoji emojiName="fire" size={12} />
                </Kb.Text>
              ) : null}
            </Kb.Box2>
          }
        >
          {inviteCounter}
        </Kb.WithTooltip>
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
    margin: Styles.globalMargins.small,
    padding: 6,
    borderRadius: 4,
  },
  container: {
    ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.medium),
  },
  counter: {
    color: Styles.globalColors.blueLighterOrBlack_50,
  },
  inviteCounterBox: Styles.platformStyles({
    isMobile: {
      flex: 1,
      justifyContent: 'flex-end',
    },
  }),
  mobileContainer: {
    backgroundColor: Styles.globalColors.blueDarkOrGreyDarkest,
    padding: Styles.globalMargins.xsmall,
  },
  tooltip: {
    color: Styles.globalColors.white,
  },
}))
