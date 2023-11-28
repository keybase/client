import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'

export const InviteItem = ({
  alignSelf,
  inviteLink,
  showDetails,
  showExpireAction,
  style,
  teamID,
}: {
  alignSelf?: 'flex-start'
  inviteLink: T.Teams.InviteLink
  showDetails: boolean
  showExpireAction: boolean
  style?: Kb.Styles.StylesCrossPlatform
  teamID: T.Teams.TeamID
}) => {
  const yourUsername = C.useCurrentUserState(s => s.username)
  const [waitingForExpire, setWaitingForExpire] = React.useState(false)
  const removePendingInvite = C.useTeamsState(s => s.dispatch.removePendingInvite)
  const onExpire = () => {
    removePendingInvite(teamID, inviteLink.id)

    // wait until reload happens due to MetadataUpdate notification; otherwise it flashes
    // active in between the rpc finish and the team reload
    setWaitingForExpire(true)
  }

  return (
    <Kb.Box2
      direction="vertical"
      style={Kb.Styles.collapseStyles([styles.inviteContainer, style])}
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
            style={Kb.Styles.globalStyles.positionRelative}
          >
            <Kb.Text
              type={waitingForExpire ? 'BodySmall' : 'BodySmallPrimaryLink'}
              onClick={waitingForExpire ? undefined : onExpire}
              style={waitingForExpire ? styles.disabledText : undefined}
            >
              Expire now
            </Kb.Text>
            {waitingForExpire && (
              <Kb.Box2
                direction="horizontal"
                centerChildren={true}
                style={Kb.Styles.globalStyles.fillAbsolute}
              >
                <Kb.ProgressIndicator type="Small" />
              </Kb.Box2>
            )}
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  disabledText: {opacity: 0.4},
  inviteContainer: {
    borderColor: Kb.Styles.globalColors.black_10,
    borderRadius: Kb.Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Kb.Styles.globalMargins.tiny,
  },
}))
