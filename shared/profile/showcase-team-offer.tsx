import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useTeamsList} from '@/teams/use-teams-list'
import {useConfigState} from '@/stores/config'

const ShowcaseTeamOffer = () => {
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
    <Kb.Box2 direction="vertical" flex={1} overflow="hidden">
      {!isMobile && <ShowcaseTeamOfferHeader />}
      <Kb.ScrollView>
        {isMobile && <ShowcaseTeamOfferHeader />}
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
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="small" style={styles.teamRowShowcaseTeamOffer}>
        <Kb.Avatar isTeam={true} size={isMobile ? 48 : 32} teamname={name} />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.teamNameShowcaseTeamOffer}>
          <Kb.Box2 direction="horizontal" fullWidth={true} alignSelf="flex-start">
            <Kb.Text type="BodySemibold" lineClamp={1}>
              {name}
            </Kb.Text>
            {isOpen && (
              <Kb.Meta variant="open" style={styles.meta} />
            )}
          </Kb.Box2>
          <Kb.Text type="BodySmall">{String(membercount) + ' member' + (membercount !== 1 ? 's' : '')}</Kb.Text>
        </Kb.Box2>
        {showcased || canShowcase || waiting ? (
          <Kb.Button
            label={showcased ? 'Featured' : 'Feature'}
            onClick={() => onPromote(!showcased)}
            small={true}
            type="Success"
            mode={showcased ? 'Secondary' : 'Primary'}
            waiting={waiting}
          />
        ) : (
          <Kb.Text style={styles.membershipText} type="BodySmall">
            {isExplicitMember
              ? "Admins aren't allowing members to feature."
              : 'Add yourself to the team first.'}
          </Kb.Text>
        )}
      </Kb.Box2>
      {!isMobile && <Kb.Divider style={{marginLeft: 48}} />}
    </Kb.Box2>
  )
}

const ShowcaseTeamOfferHeader = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerShowcaseTeamOffer}>
    <Kb.InfoNote containerStyle={styles.noteShowcaseTeamOffer}>
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
      headerShowcaseTeamOffer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
          paddingTop: Kb.Styles.globalMargins.mediumLarge,
        },
      }),
      membershipText: Kb.Styles.platformStyles({
        common: {
          alignSelf: 'center',
          color: Kb.Styles.globalColors.black_50,
          flexShrink: 1,
        },
        isElectron: {textAlign: 'right'},
        isMobile: {textAlign: 'center'},
      }),
      meta: {
        marginLeft: Kb.Styles.globalMargins.xtiny,
        marginTop: 2,
      },
      noteShowcaseTeamOffer: Kb.Styles.platformStyles({
        isMobile: {paddingTop: Kb.Styles.globalMargins.small},
      }),
      noteText: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.large, Kb.Styles.globalMargins.small),
      },
      teamNameShowcaseTeamOffer: {flexShrink: 1},
      teamRowShowcaseTeamOffer: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
        },
        isMobile: {minHeight: 64},
      }),
    }) as const
)

export default ShowcaseTeamOffer
