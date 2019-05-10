// @flow
import * as React from 'react'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import {namedConnect} from '../../util/container'
import ConflictBanner, {getHeight} from './conflict-banner'
import * as RowTypes from '../row/types'
import openUrl from '../../util/open-url'

type OwnProps = {|path: Types.Path, conflictState: Types.ConflictState|}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _tlf: Constants.getTlfFromPath(state.fs.tlfs, path),
})

const mapDispatchToProps = dispatch => ({
  onFeedback: () => {},
  onFinishResolving: () => {},
  onHelp: () => openUrl('https://keybase.io/docs/kbfs/understanding_kbfs#conflict_resolution'),
  onSeeOtherView: () => {},
  onStartResolving: () => {},
})

const mergeProps = (s, d, o) => ({
  ...s,
  ...d,
  ...o,
  isUnmergedView: Constants.isUnmergedView(o.path),
})

const ConnectedBanner = namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConflictBanner'
)(ConflictBanner)

export default ConnectedBanner

export const asRows = (path: Types.Path, conflictState: Types.ConflictState): Array<RowTypes.HeaderRowItem> =>
  conflictState === 'none'
    ? []
    : [
        {
          height: getHeight(conflictState),
          key: 'conflict-banner',
          node: <ConnectedBanner path={path} conflictState={conflictState} />,
          rowType: 'header',
        },
      ]
