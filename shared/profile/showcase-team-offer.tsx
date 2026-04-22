import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useTeamsList} from '@/teams/use-teams-list'
import {useConfigState} from '@/stores/config'

const Container = () => {
  const waiting = C.useWaitingState(s => s.counts)
  const {reload, teams} = useTeamsList()
  const setGlobalError = useConfigState(s => s.dispatch.setGlobalError)
  const setMemberPublicity = C.useRPC(T.RPCGen.teamsSetTeamMemberShowcaseRpcPromise)
  const sortedTeams = [...teams].sort((a, b) => a.teamname.localeCompare(b.teamname))
  const onPromote = (teamID: T.Teams.TeamID, promoted: boolean) => {
    setMemberPublicity(
      [
        {isShowcased: promoted, teamID},
        [C.waitingKeyTeamsTeam(teamID), C.waitingKeyTeamsSetMemberPublicity(teamID)],
      ],
      reload,
      error => setGlobalError(error)
    )
  }

  return (
    <>
      <Kb.Box2 direction="vertical" style={styles.container}>
        {!Kb.Styles.isMobile && <ShowcaseTeamOfferHeader />}
        <Kb.ScrollView>
          {Kb.Styles.isMobile && <ShowcaseTeamOfferHeader />}
          {sortedTeams.map(teamMeta => (
            <TeamRow
              key={teamMeta.id}
              canShowcase={
                (teamMeta.allowPromote && teamMeta.isMember) || ['admin', 'owner'].includes(teamMeta.role)
              }
              isExplicitMember={teamMeta.isMember}
              name={teamMeta.teamname}
              isOpen={teamMeta.isOpen}
              membercount={teamMeta.memberCount}
              onPromote={promoted => onPromote(teamMeta.id, promoted)}
              showcased={teamMeta.showcasing}
              waiting={!!waiting.get(C.waitingKeyTeamsTeam(teamMeta.id))}
            />
          ))}
        </Kb.ScrollView>
      </Kb.Box2>
    </>
  )
}

type RowProps = {
  canShowcase: boolean
  name: T.Teams.Teamname
  isOpen: boolean
  membercount: number
  onPromote: (promote: boolean) => void
  showcased: boolean
  waiting: boolean
  isExplicitMember: boolean
}

const TeamRow = (p: RowProps) => {
  const {canShowcase, name, isOpen, membercount, onPromote, showcased, waiting, isExplicitMember} = p
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamRowContainer}>
        <Kb.Avatar isTeam={true} size={Kb.Styles.isMobile ? 48 : 32} teamname={name} />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.teamNameContainer}>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamText}>
            <Kb.Text type="BodySemibold" lineClamp={1}>
              {name}
            </Kb.Text>
            {isOpen && (
              <Kb.Meta title="open" style={styles.meta} backgroundColor={Kb.Styles.globalColors.green} />
            )}
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" style={styles.teamText}>
            <Kb.Text type="BodySmall">{membercount + ' member' + (membercount !== 1 ? 's' : '')}</Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
        {showcased || canShowcase || waiting ? (
          <Kb.Box2 direction="vertical">
            <Kb.Button
              label={showcased ? 'Featured' : 'Feature'}
              onClick={() => onPromote(!showcased)}
              small={true}
              type="Success"
              mode={showcased ? 'Secondary' : 'Primary'}
              waiting={waiting}
            />
          </Kb.Box2>
        ) : (
          <Kb.Box2 direction="vertical" style={styles.membershipTextContainer}>
            <Kb.Text style={styles.membershipText} type="BodySmall">
              {isExplicitMember
                ? "Admins aren't allowing members to feature."
                : 'Add yourself to the team first.'}
            </Kb.Text>
          </Kb.Box2>
        )}
      </Kb.Box2>
      {!Kb.Styles.isMobile && <Kb.Divider style={{marginLeft: 48}} />}
    </Kb.Box2>
  )
}

const ShowcaseTeamOfferHeader = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerContainer}>
    <Kb.InfoNote containerStyle={styles.noteContainer}>
      <Kb.Text center={true} style={styles.noteText} type="BodySmall">
        Featuring a team will encourage others to ask to join. The team&apos;s description and number of
        members will be public.
      </Kb.Text>
    </Kb.InfoNote>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {flex: 1, overflow: 'hidden'},
      headerContainer: Kb.Styles.platformStyles({
        isElectron: {
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
          paddingTop: Kb.Styles.globalMargins.mediumLarge,
        },
      }),
      membershipText: Kb.Styles.platformStyles({
        common: {color: Kb.Styles.globalColors.black_50},
        isElectron: {textAlign: 'right'},
        isMobile: {textAlign: 'center'},
      }),
      membershipTextContainer: {flexShrink: 1},
      meta: {
        alignSelf: 'center',
        marginLeft: Kb.Styles.globalMargins.xtiny,
        marginTop: 2,
      },
      noteContainer: Kb.Styles.platformStyles({
        isMobile: {paddingTop: Kb.Styles.globalMargins.small},
      }),
      noteText: {
        paddingBottom: Kb.Styles.globalMargins.small,
        paddingLeft: Kb.Styles.globalMargins.large,
        paddingRight: Kb.Styles.globalMargins.large,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      teamNameContainer: {
        flexShrink: 1,
        marginLeft: Kb.Styles.globalMargins.small,
        marginRight: Kb.Styles.globalMargins.small,
      },
      teamRowContainer: Kb.Styles.platformStyles({
        common: {
          paddingBottom: Kb.Styles.globalMargins.tiny,
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {minHeight: Kb.Styles.isMobile ? 64 : 48},
      }),
      teamText: {alignSelf: 'flex-start'},
    }) as const
)

export default Container
