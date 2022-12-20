import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {teamWaitingKey} from '../../constants/teams'
import type * as Types from '../../constants/types/teams'
import {useTeamsSubscribe} from '../../teams/subscriber'

export type RowProps = {
  canShowcase: boolean
  name: Types.Teamname
  isOpen: boolean
  membercount: number
  onPromote: (promote: boolean) => void
  showcased: boolean
  waiting: boolean
  isExplicitMember: boolean
}

export type Props = {
  onCancel: () => void
  onPromote: (teamID: Types.TeamID, promote: boolean) => void
  teams: ReadonlyArray<Types.TeamMeta>
  waiting: Map<string, number>
}

const TeamRow = ({
  canShowcase,
  name,
  isOpen,
  membercount,
  onPromote,
  showcased,
  waiting,
  isExplicitMember,
}: RowProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamRowContainer}>
      <Kb.Avatar isTeam={true} size={Styles.isMobile ? 48 : 32} teamname={name} />
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.teamNameContainer}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamText}>
          <Kb.Text type="BodySemibold" lineClamp={1}>
            {name}
          </Kb.Text>
          {isOpen && <Kb.Meta title="open" style={styles.meta} backgroundColor={Styles.globalColors.green} />}
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
              ? 'Admins aren’t allowing members to feature.'
              : 'Add yourself to the team first.'}
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box2>
    {!Styles.isMobile && <Kb.Divider style={{marginLeft: 48}} />}
  </Kb.Box2>
)

const ShowcaseTeamOfferHeader = () => (
  <Kb.Box style={styles.headerContainer}>
    {!Styles.isMobile && (
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.headerText}>
        <Kb.Text type="Header">Feature the teams you’re in</Kb.Text>
      </Kb.Box2>
    )}
    <Kb.InfoNote containerStyle={styles.noteContainer}>
      <Kb.Text center={true} style={styles.noteText} type="BodySmall">
        Featuring a team will encourage others to ask to join. The team's description and number of members
        will be public.
      </Kb.Text>
    </Kb.InfoNote>
  </Kb.Box>
)

const ShowcaseTeamOffer = (props: Props) => {
  useTeamsSubscribe()
  return (
    <Kb.PopupWrapper onCancel={props.onCancel} title="Feature your teams" customCancelText="Close">
      <Kb.Box2 direction="vertical" style={styles.container}>
        {!Styles.isMobile && <ShowcaseTeamOfferHeader />}
        <Kb.ScrollView>
          {Styles.isMobile && <ShowcaseTeamOfferHeader />}
          {props.teams.map(teamMeta => (
            <TeamRow
              key={teamMeta.id}
              canShowcase={
                (teamMeta.allowPromote && teamMeta.isMember) || ['admin', 'owner'].includes(teamMeta.role)
              }
              isExplicitMember={teamMeta.isMember}
              name={teamMeta.teamname}
              isOpen={teamMeta.isOpen}
              membercount={teamMeta.memberCount}
              onPromote={promoted => props.onPromote(teamMeta.id, promoted)}
              showcased={teamMeta.showcasing}
              waiting={!!props.waiting[teamWaitingKey(teamMeta.id)]}
            />
          ))}
        </Kb.ScrollView>
      </Kb.Box2>
    </Kb.PopupWrapper>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        isElectron: {
          maxHeight: 600,
          maxWidth: 600,
        },
      }),
      headerContainer: Styles.platformStyles({
        isElectron: {
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
          paddingTop: Styles.globalMargins.mediumLarge,
        },
      }),
      headerText: {
        marginBottom: Styles.globalMargins.xsmall,
      },
      membershipText: Styles.platformStyles({
        common: {color: Styles.globalColors.black_50},
        isElectron: {textAlign: 'right'},
        isMobile: {textAlign: 'center'},
      }),
      membershipTextContainer: {
        flexShrink: 1,
      },
      meta: {
        alignSelf: 'center',
        marginLeft: Styles.globalMargins.xtiny,
        marginTop: 2,
      },
      noteContainer: Styles.platformStyles({
        isMobile: {
          paddingTop: Styles.globalMargins.small,
        },
      }),
      noteText: {
        paddingBottom: Styles.globalMargins.small,
        paddingLeft: Styles.globalMargins.large,
        paddingRight: Styles.globalMargins.large,
        paddingTop: Styles.globalMargins.tiny,
      },
      teamNameContainer: {
        flexShrink: 1,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
      },
      teamRowContainer: Styles.platformStyles({
        common: {
          paddingBottom: Styles.globalMargins.tiny,
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
          paddingTop: Styles.globalMargins.tiny,
        },
        isMobile: {
          minHeight: Styles.isMobile ? 64 : 48,
        },
      }),
      teamText: {
        alignSelf: 'flex-start',
      },
    } as const)
)

export default ShowcaseTeamOffer
