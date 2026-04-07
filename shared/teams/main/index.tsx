import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import TeamsFooter from './footer'
import TeamRowNew from './team-row'
import {PerfProfiler} from '@/perf/react-profiler'

type DeletedTeam = {
  teamName: string
  deletedBy: string
}

export type Props = {
  deletedTeams: ReadonlyArray<DeletedTeam>
  onChangeSort: (sortOrder: T.Teams.TeamListSort) => void
  onCreateTeam: () => void
  onJoinTeam: () => void
  sortOrder: T.Teams.TeamListSort
  teams: ReadonlyArray<T.Teams.TeamMeta>
}

const TeamBigButtons = (props: {onCreateTeam: () => void; onJoinTeam: () => void; empty: boolean}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamButtons} gap="tiny" justifyContent="flex-start">
    <Kb.ClickableBox
      style={styles.bigButton}
      onClick={props.onCreateTeam}
      className="background_color_white hover_background_color_blueLighter2"
    >
      <Kb.Box2 direction="vertical" gap="tiny" alignItems="center">
        <Kb.Text type="BodyBig">Create a team</Kb.Text>
        <Kb.Box2 direction="vertical" relative={true}>
          <Kb.Avatar isTeam={true} size={96} />
          <Kb.Icon type="iconfont-add-solid" sizeType="Default" style={styles.teamPlus} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ClickableBox>
    <Kb.ClickableBox
      style={styles.bigButton}
      onClick={props.onJoinTeam}
      className="background_color_white hover_background_color_blueLighter2"
    >
      <Kb.Box2 direction="vertical" gap="tiny" alignItems="center">
        <Kb.Text type="BodyBig">Join a team</Kb.Text>
        <Kb.ImageIcon type="icon-illustration-teams-96" />
      </Kb.Box2>
    </Kb.ClickableBox>
    {props.empty && !Kb.Styles.isMobile && (
      <Kb.Text type="BodySmall" style={styles.emptyNote}>
        Keybase team chats are encrypted – unlike Slack – and work for any size group, from casual friends to
        large communities.
      </Kb.Text>
    )}
  </Kb.Box2>
)

const sortOrderToTitle = {
  activity: 'Activity',
  alphabetical: 'Alphabetical',
  role: 'Your role',
}
const SortHeader = ({onChangeSort, sortOrder}: {onChangeSort: Props['onChangeSort']; sortOrder: Props['sortOrder']}) => {
  const makePopup = (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          items={[
            {icon: 'iconfont-team', onClick: () => onChangeSort('role'), title: sortOrderToTitle.role},
            {
              icon: 'iconfont-campfire',
              onClick: () => onChangeSort('activity'),
              title: sortOrderToTitle.activity,
            },
            {
              icon: 'iconfont-sort-alpha',
              onClick: () => onChangeSort('alphabetical'),
              title: sortOrderToTitle.alphabetical,
            },
          ]}
          closeOnSelect={true}
          onHidden={hidePopup}
          visible={true}
          position="bottom left"
        />
      )
    }

  const {popup, showPopup, popupAnchor} = Kb.usePopup2(makePopup)
  return (
    <Kb.Box2 direction="horizontal" style={styles.sortHeader} alignItems="center" fullWidth={true}>
      <Kb.ClickableBox onClick={showPopup} ref={popupAnchor}>
        <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center">
          <Kb.Icon type="iconfont-arrow-full-down" />
          <Kb.Text type="BodySmallSemibold">{sortOrderToTitle[sortOrder]}</Kb.Text>
        </Kb.Box2>
      </Kb.ClickableBox>
      {popup}
    </Kb.Box2>
  )
}

const teamRowHeight = Kb.Styles.isMobile ? 72 : 48
const teamRowItemHeight = {height: teamRowHeight, type: 'fixed' as const}

type TeamItem = T.Teams.TeamMeta

const Teams = function Teams(p: Props) {
  const {deletedTeams, teams, onCreateTeam, onJoinTeam, onChangeSort, sortOrder} = p

  const listHeader = (
    <>
      <TeamBigButtons onCreateTeam={onCreateTeam} onJoinTeam={onJoinTeam} empty={teams.length === 0} />
      <SortHeader onChangeSort={onChangeSort} sortOrder={sortOrder} />
      {deletedTeams.map(dt => (
        <Kb.Banner color="blue" key={'deletedTeamBannerFor' + dt.teamName}>
          <Kb.BannerParagraph
            bannerColor="blue"
            content={`The ${dt.teamName} team was deleted by ${dt.deletedBy}.`}
          />
        </Kb.Banner>
      ))}
    </>
  )

  const listFooter = <TeamsFooter empty={teams.length === 0} />

  const renderItem = (_index: number, item: TeamItem) => {
    return (
      <PerfProfiler id="TeamRow">
        <TeamRowNew showChat={!Kb.Styles.isMobile} teamID={item.id} />
      </PerfProfiler>
    )
  }

  return (
    <PerfProfiler id="TeamsList">
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
        <Kb.BoxGrow>
          <Kb.List
            items={teams}
            renderItem={renderItem}
            itemHeight={teamRowItemHeight}
            keyProperty="id"
            testID="teamsList"
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            recycleItems={true}
          />
        </Kb.BoxGrow>
      </Kb.Box2>
    </PerfProfiler>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bigButton: Kb.Styles.platformStyles({
        common: {
          borderColor: Kb.Styles.globalColors.black_10,
          borderRadius: 8,
          borderStyle: 'solid',
          borderWidth: 1,
        },
        isElectron: {padding: Kb.Styles.globalMargins.small},
        isMobile: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.small, 0),
          backgroundColor: Kb.Styles.globalColors.white,
          width: 140,
        },
      }),
      container: {backgroundColor: Kb.Styles.globalColors.blueGrey},
      emptyNote: Kb.Styles.padding(60, 42, Kb.Styles.globalMargins.medium, Kb.Styles.globalMargins.medium),
      sortHeader: Kb.Styles.platformStyles({
        common: {backgroundColor: Kb.Styles.globalColors.blueGrey},
        isElectron: {...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small)},
        isMobile: {...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.tiny)},
      }),
      teamButtons: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
        backgroundColor: Kb.Styles.globalColors.blueGrey,
      },
      teamPlus: {
        bottom: -2,
        color: Kb.Styles.globalColors.blue,
        position: 'absolute',
        right: -1,
      },
    }) as const
)

export default Teams
