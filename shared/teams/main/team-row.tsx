import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as Container from '../../util/container'
import {pluralize} from '../../util/string'

type Props = {
  firstItem: boolean
  showChat?: boolean // default true
  teamID: Types.TeamID
}

const TeamRow = (props: Props) => {
  const {firstItem, showChat = true, teamID} = props
  const dispatch = Container.useDispatch()
  const teamMeta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))

  const onViewTeam = () => {} // TODO

  return (
    <Kb.ListItem2
      type="Small"
      firstItem={firstItem}
      onClick={onViewTeam}
      icon={<Kb.Avatar size={32} teamname={teamMeta.teamname} isTeam={true} />}
      body={
        <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.bodyContainer}>
          <Kb.Box2 direction="horizontal" fullHeight={true} alignItems="center" style={styles.bodyLeft}>
            <Kb.Box2 direction="vertical" fullHeight={true} style={styles.bodyLeftText}>
              <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start" alignItems="center">
                <Kb.Text type="BodySemibold">{teamMeta.teamname}</Kb.Text>
                {teamMeta.isOpen && (
                  <Kb.Meta title="open" backgroundColor={Styles.globalColors.green} style={styles.openMeta} />
                )}
              </Kb.Box2>
              <Kb.Text type="BodySmall">
                {teamMeta.memberCount.toLocaleString()} {pluralize('member', teamMeta.memberCount)}
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" fullHeight={true} style={styles.bodyRight}></Kb.Box2>
        </Kb.Box2>
      }
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  bodyContainer: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
  bodyLeft: {
    // backgroundColor: Styles.globalColors.blue,
    flex: 1,
  },
  bodyLeftText: {justifyContent: 'center'},
  bodyRight: {
    // backgroundColor: Styles.globalColors.green,
    flex: 0.7,
  },
  openMeta: {
    alignSelf: 'center',
  },
}))

export default TeamRow
