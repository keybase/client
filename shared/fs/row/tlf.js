// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Constants from '../../constants/fs'
import {rowStyles, StillCommon, type StillCommonProps} from './common'
import * as Kb from '../../common-adapters'
import {TlfInfo} from '../common'

type TlfProps = StillCommonProps & {
  isNew: boolean,
  needsRekey: boolean,
  // We don't use this at the moment. In the future this will be used for
  // showing ignored folders when we allow user to show ignored folders in GUI.
  isIgnored: boolean,
  routePath: I.List<string>,
}

const Tlf = (props: TlfProps) => (
  <StillCommon
    name={props.name}
    path={props.path}
    onOpen={props.onOpen}
    inDestinationPicker={props.inDestinationPicker}
    badge={props.isNew ? 'new' : props.needsRekey ? 'rekey' : null}
    routePath={props.routePath}
  >
    <Kb.Box style={rowStyles.itemBox}>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Text
          type={Constants.pathTypeToTextType('folder')}
          style={Styles.collapseStyles([rowStyles.rowText, {color: Constants.getPathTextColor(props.path)}])}
          lineClamp={Styles.isMobile ? 1 : undefined}
        >
          {props.name}
        </Kb.Text>
      </Kb.Box2>
      <TlfInfo path={props.path} mode="row" />
    </Kb.Box>
  </StillCommon>
)

export default Tlf
