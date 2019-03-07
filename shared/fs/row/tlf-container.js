// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as RowTypes from './types'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import OpenHOC from '../common/open-hoc'
import Tlf from './tlf'

type OwnProps = $Diff<RowTypes.TlfRowItem, {rowType: 'tlf'}> & {
  routePath: I.List<string>,
  destinationPickerIndex?: number,
}

const mapStateToProps = (state, {tlfType, name}: OwnProps) => ({
  _tlf: Constants.getTlfFromTlfs(state.fs.tlfs, tlfType, name),
  _username: state.config.username,
})

const mergeProps = (stateProps, dispatchProps, {tlfType, name, routePath, destinationPickerIndex}) => {
  const shouldBadge = Constants.tlfIsBadged(stateProps._tlf)
  const path = Constants.tlfTypeAndNameToPath(tlfType, name)
  return {
    destinationPickerIndex,
    isIgnored: stateProps._tlf.isIgnored,
    isNew: shouldBadge && stateProps._tlf.isNew,
    name,
    needsRekey: shouldBadge && stateProps._tlf.needsRekey,
    path,
    routePath,
  }
}

export default ((ComposedComponent: React.ComponentType<any>) =>
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, () => ({}), mergeProps, 'ConnectedTlfRow')(
    OpenHOC(ComposedComponent)
  ))(Tlf)
