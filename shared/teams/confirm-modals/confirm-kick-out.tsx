import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/teams'
import * as Styles from '../../styles'
import * as Constants from '../../constants/teams'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {RPCError} from '../../util/errors'

type Props = Container.RouteProps<{members: string[]; teamID: Types.TeamID}>

const ConfirmKickOut = (props: Props) => {
  const members = Container.getRouteProps(props, 'members', [])
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  const [subteamsToo, setSubteamsToo] = React.useState(false)

  const teamname = Container.useSelector(state => Constants.getTeamMeta(state, teamID).teamname)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onCancel = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])

  const removeMembersRPC = Container.useRPC(RPCTypes.teamsTeamRemoveMembersRpcPromise)
  const [result, setResult] = React.useState<RPCTypes.TeamRemoveMembersResult>({failures: []})
  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState<RPCError | null>(null)
  const removeMembers = React.useCallback(() => {
    setWaiting(true)
    const teamMemberToRemoves = members.map(member => {
      return {
        type: 0, // TODO how do I get RPCTypes.TeamMemberToRemoveType.assertion to typecheck?
        assertion: {
          assertion: member,
          removeFromSubtree: subteamsToo,
        },
      }
    })
    removeMembersRPC(
      [{teamID, members: teamMemberToRemoves, noErrorOnPartialFailure: true}],
      result => {
        setResult(result)
        setWaiting(false)
      },
      err => {
        setError(err)
        setWaiting(false)
      }
    )
  }, [teamID, members, removeMembersRPC, subteamsToo, waiting, setWaiting])

  const onRemove = () => {
    removeMembers()
  }

  const anyError = error || result?.failures?.length

  const wasWaiting = Container.usePrevious(waiting)
  React.useEffect(() => {
    if (wasWaiting && !waiting && !anyError) {
      // TODO this breaks the app, [team member view] no data! this should never happen
      dispatch(nav.safeNavigateUpPayload())
    }
  }, [waiting, wasWaiting, dispatch, error, result, nav])

  const prompt = (
    <Kb.Text center={true} type="Header" style={styles.prompt}>
      Kick {Constants.stringifyPeople(members)} out of {teamname}?
    </Kb.Text>
  )
  const header = (
    <Kb.Box style={styles.positionRelative}>
      <Kb.AvatarLine usernames={members} size={64} layout="horizontal" maxShown={5} />
      <Kb.Box2
        direction="horizontal"
        centerChildren={true}
        style={Styles.collapseStyles([styles.iconContainer, members.length > 5 && styles.iconContainerMany])}
      >
        <Kb.Icon
          type="iconfont-block"
          color={Styles.globalColors.white}
          fontSize={14}
          style={styles.headerIcon}
        />
      </Kb.Box2>
    </Kb.Box>
  )
  return (
    <Kb.ConfirmModal
      header={header}
      prompt={prompt}
      content={
        <Kb.Box2 direction="vertical" gap="small" fullWidth={true} style={styles.container}>
          <Kb.Text type="Body" center={true}>
            They will lose access to all the team chats and folders, and they won’t be able to get back unless
            an admin invites them.
          </Kb.Text>
          <Kb.Checkbox
            checked={subteamsToo}
            onCheck={setSubteamsToo}
            labelComponent={
              <Kb.Text type="Body" style={Styles.globalStyles.flexOne}>
                Also kick them out of any subteams of {teamname}
              </Kb.Text>
            }
            style={Styles.globalStyles.fullWidth}
          />
          {anyError ? (
            <Kb.Banner color="red">
              {error ? (
                <Kb.BannerParagraph
                  key="removeMembersTotalError"
                  bannerColor="red"
                  content={[`Unable to remove members: ${error.message}`]}
                />
              ) : (
                <></>
              )}
              {result.failures?.length ? (
                <>
                  <Kb.BannerParagraph
                    key="removeMembersPartialError"
                    bannerColor="red"
                    content={['The following errors occurred:']}
                  />
                  {result.failures.map((failure, idx) => {
                    var where = ``
                    if (failure.errorAtTarget) {
                      where += `from ${teamname}`
                    }
                    if (failure.errorAtTarget && failure.errorAtSubtree) {
                      where += ` and `
                    }
                    if (failure.errorAtSubtree) {
                      where += `from ${teamname}'s subteams`
                    }
                    var who = ``
                    if (failure.teamMember.type == RPCTypes.TeamMemberToRemoveType.assertion) {
                      who = failure.teamMember.assertion.assertion
                    } else if (failure.teamMember.type == RPCTypes.TeamMemberToRemoveType.inviteid) {
                      who = 'invite ' + failure.teamMember.inviteid.inviteID
                    }
                    return (
                      <Kb.BannerParagraph
                        key={'removeMembersErrorRow' + idx.toString()}
                        bannerColor="red"
                        content={`• failed to remove ${who} ${where}`}
                      />
                    )
                  })}
                </>
              ) : (
                <></>
              )}
            </Kb.Banner>
          ) : (
            <></>
          )}
        </Kb.Box2>
      }
      onCancel={onCancel}
      onConfirm={onRemove}
      confirmText={anyError ? 'Retry' : 'Kick out'}
      waiting={waiting}
    />
  )
}
export default ConfirmKickOut

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.padding(0, Styles.globalMargins.small),
  headerIcon: Styles.platformStyles({
    common: {position: 'relative'},
    isElectron: {top: 1},
    isMobile: {right: -0.5, top: 0.5},
  }),
  iconContainer: {
    backgroundColor: Styles.globalColors.red,
    borderColor: Styles.globalColors.white,
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: 3,
    bottom: -3,
    height: 24,
    overflow: 'hidden',
    position: 'absolute',
    right: Styles.isMobile ? -24 : 0,
    width: 24,
  },
  iconContainerMany: {
    right: Styles.isMobile ? 0 : 20,
  },
  positionRelative: {
    position: 'relative',
  },
  prompt: Styles.padding(0, Styles.globalMargins.small, Styles.globalMargins.tiny),
}))
