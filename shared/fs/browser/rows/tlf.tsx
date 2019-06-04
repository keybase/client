import * as I from 'immutable'
import * as React from 'react'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/fs'
import * as Types from '../../../constants/types/fs'
import {rowStyles, StillCommon, StillCommonProps} from './common'
import * as Kb from '../../../common-adapters'
import {LoadPathMetadataWhenNeeded, TlfInfo, Filename} from '../../common'

type TlfProps = StillCommonProps & {
  isNew: boolean
  loadPathMetadata?: boolean
  // We don't use this at the moment. In the future this will be used for
  // showing ignored folders when we allow user to show ignored folders in GUI.
  isIgnored: boolean
  routePath: I.List<string>
  usernames: I.List<string>
}

const Tlf = (props: TlfProps) => (
  <StillCommon
    name={props.name}
    path={props.path}
    onOpen={props.onOpen}
    inDestinationPicker={props.inDestinationPicker}
    badge={props.isNew ? Types.PathItemBadgeType.New : null}
    routePath={props.routePath}
    animateActions={true}
  >
    {props.loadPathMetadata && <LoadPathMetadataWhenNeeded path={props.path} />}
    <Kb.Box style={rowStyles.itemBox}>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.BoxGrow>
          <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.leftBox}>
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.minWidth}>
              <Filename
                type={Constants.pathTypeToTextType(Types.PathType.Folder)}
                style={Styles.collapseStyles([rowStyles.rowText, styles.kerning])}
                path={props.path}
              />
            </Kb.Box2>
            <TlfInfo path={props.path} mode="row" />
          </Kb.Box2>
        </Kb.BoxGrow>
        {!Styles.isMobile && (
          <Kb.Box style={styles.avatarBox}>
            {Constants.isTeamPath(props.path) ? (
              <Kb.Avatar size={32} isTeam={true} teamname={props.usernames.get(0)} />
            ) : (
              <Kb.AvatarLine
                maxShown={4}
                size={32}
                layout="horizontal"
                usernames={props.usernames.toArray()}
              />
            )}
          </Kb.Box>
        )}
      </Kb.Box2>
    </Kb.Box>
  </StillCommon>
)

const styles = Styles.styleSheetCreate({
  avatarBox: {marginRight: Styles.globalMargins.xsmall},
  kerning: {letterSpacing: 0.2},
  leftBox: {flex: 1, justifyContent: 'center', minWidth: 0},
  minWidth: {minWidth: 0},
})

export default Tlf
