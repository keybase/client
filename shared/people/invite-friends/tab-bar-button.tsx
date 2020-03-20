import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RPCGen from '../../constants/types/rpc-gen'
import InviteHow from './invite-how'

const InviteFriends = () => {
  const getInviteCounts = Container.useRPC(RPCGen.inviteFriendsGetInviteCountsRpcPromise)
  const [invitesCount, setInvitesCount] = React.useState<number | null>(null)
  const [percentage, setPercentage] = React.useState(0)
  const [showFire, setShowFire] = React.useState(false)
  React.useEffect(() => {
    getInviteCounts(
      [undefined], // Is this really the best way to call an RPC with no args?
      r => {
        setInvitesCount(r.inviteCount)
        setPercentage(r.percentageChange)
        setShowFire(r.showFire)
      },
      () => {}
    )
  }, [setShowFire, setPercentage, setInvitesCount]) // TODO: consider refreshing each hour/day/etc

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
  const inviteCounter =
    invitesCount === null ? null : (
      <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true}>
        <Kb.Icon type="iconfont-envelope" sizeType="Small" color={Styles.globalColors.blueDarkerOrBlack_85} />
        <Kb.Text type="BodySmallBold" style={styles.counter}>
          {invitesCount.toLocaleString()} {showFire ? <Kb.Emoji emojiName="fire" size={12} /> : null}
        </Kb.Text>
      </Kb.Box2>
    )
  const firstTooltipLine = `${invitesCount?.toLocaleString()} friends invited in the last 24 hours.`
  return Styles.isMobile ? (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.mobileContainer}>
      <Kb.Box style={Styles.globalStyles.flexOne} />
      {inviteButton}
      <Kb.Box2 direction="horizontal" style={styles.inviteCounterBox}>
        {invitesCount === null ? null : (
          <Kb.WithTooltip tooltip={firstTooltipLine} showOnPressMobile={true}>
            {inviteCounter}
          </Kb.WithTooltip>
        )}
      </Kb.Box2>
      {popup}
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
                {firstTooltipLine}
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
