import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import type * as Types from '../../../constants/types/teams'
import * as TeamsGen from '../../../actions/teams-gen'

export const InviteItem = ({
  alignSelf,
  inviteLink,
  showDetails,
  showExpireAction,
  style,
  teamID,
}: {
  alignSelf?: 'flex-start'
  inviteLink: Types.InviteLink
  showDetails: boolean
  showExpireAction: boolean
  style?: Styles.StylesCrossPlatform
  teamID: Types.TeamID
}) => {
  const dispatch = Container.useDispatch()
  const yourUsername = Container.useSelector(s => s.config.username)
  const [waitingForExpire, setWaitingForExpire] = React.useState(false)
  const onExpire = () => {
    dispatch(TeamsGen.createRemovePendingInvite({inviteID: inviteLink.id, teamID}))

    // wait until reload happens due to MetadataUpdate notification; otherwise it flashes
    // active in between the rpc finish and the team reload
    setWaitingForExpire(true)
  }

  return (
    <Kb.Box2
      direction="vertical"
      style={Styles.collapseStyles([styles.inviteContainer, style])}
      gap="xtiny"
      alignSelf={alignSelf}
    >
      <Kb.CopyText
        text={inviteLink.url}
        disabled={!inviteLink.isValid || waitingForExpire}
        containerStyle={{minHeight: 32}}
      />
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text type="BodySmall">
          Invites as {inviteLink.role} • {inviteLink.validityDescription}
        </Kb.Text>
        {showDetails && (
          <Kb.Text type="BodySmall">
            Created by{' '}
            {inviteLink.creatorUsername === yourUsername ? (
              'you'
            ) : (
              <Kb.ConnectedUsernames
                inline={true}
                colorFollowing={true}
                type="BodySmallBold"
                usernames={inviteLink.creatorUsername}
              />
            )}{' '}
            • {inviteLink.numUses.toLocaleString()} joined
            {!!inviteLink.lastJoinedUsername && (
              <Kb.Text type="BodySmall">
                , most recently{' '}
                <Kb.ConnectedUsernames
                  inline={true}
                  colorFollowing={true}
                  type="BodySmallBold"
                  usernames={inviteLink.lastJoinedUsername}
                />
              </Kb.Text>
            )}
          </Kb.Text>
        )}
        {showExpireAction && inviteLink.isValid && (
          <Kb.Box2
            direction="horizontal"
            alignSelf="flex-start"
            alignItems="center"
            gap="tiny"
            style={Styles.globalStyles.positionRelative}
          >
            <Kb.Text
              type={waitingForExpire ? 'BodySmall' : 'BodySmallPrimaryLink'}
              onClick={waitingForExpire ? undefined : onExpire}
              style={waitingForExpire ? styles.disabledText : undefined}
            >
              Expire now
            </Kb.Text>
            {waitingForExpire && (
              <Kb.Box2 direction="horizontal" centerChildren={true} style={Styles.globalStyles.fillAbsolute}>
                <Kb.ProgressIndicator type="Small" />
              </Kb.Box2>
            )}
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  disabledText: {opacity: 0.4},
  inviteContainer: {
    borderColor: Styles.globalColors.black_10,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Styles.globalMargins.tiny,
  },
}))
