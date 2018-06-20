// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as Constants from '../../../constants/teams'
import {type TypedState} from '../../../util/container'
import * as I from 'immutable'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import MemberRow from './member-row/container'

export type OwnProps = {|
  teamname: string,
|}

const order = {admin: 1, owner: 0, reader: 3, writer: 2}

const getOrderedMemberArray = (
  memberInfo: I.Map<string, Types.MemberInfo>,
  you: ?string,
  yourOperations: RPCTypes.TeamOperation
): Array<Types.MemberInfo> => {
  let returnArray = memberInfo
    .valueSeq()
    .toArray()
    .sort((a, b) => {
      // If admin list deleted users, then reset, then rest
      if (yourOperations.manageMembers) {
        if (a.isDeleted) {
          if (b.isDeleted) {
            // both are inactive, compare usernames
            return a.username.localeCompare(b.username)
          }
          // b is reset or active, should go later
          return -1
        } else if (b.isDeleted) {
          // b is deleted, should come first
          return 1
        }

        if (a.isReset) {
          if (b.isDeleted) {
            // deleted should come first
            return 1
          } else if (b.isReset) {
            // both reset, compare usernames
            return a.username.localeCompare(b.username)
          }
          // b is active, a goes first
          return -1
        }
      }
      if (yourOperations.listFirst && you) {
        if (a.username === you) {
          return -1
        } else if (b.username === you) {
          return 1
        }
      }
      if (!a.type) {
        if (!b.type) {
          // both have no type, compare usernames
          return a.username.localeCompare(b.username)
        }
        // b has a type, should go first
        return 1
      } else if (!b.type) {
        // a has a type, should go first
        return -1
      } else if (a.type === b.type) {
        // they have equal types, compare usernames
        return a.username.localeCompare(b.username)
      }
      // they have different types, higher goes first
      return order[a.type] - order[b.type]
    })

  return returnArray
}

type StateProps = {
  _memberInfo: I.Map<string, Types.MemberInfo>,
  _you: ?string,
  _yourOperations: RPCTypes.TeamOperation,
}

/* Helpers to build the teams tabs. mapStateHelper is called by the master mapStateToProps, getRows makes the rows to be injected below the header, renderItem renders the individual row */
export const mapStateHelper = (state: TypedState, ownProps: {teamname: string}): $Exact<StateProps> => ({
  _memberInfo: Constants.getTeamMembers(state, ownProps.teamname),
  _you: state.config.username || '',
  _yourOperations: Constants.getCanPerform(state, ownProps.teamname),
})

export const getRows = ({_memberInfo, _you, _yourOperations}: StateProps) =>
  // $FlowIssue not sure
  getOrderedMemberArray(_memberInfo, _you, _yourOperations).map(i => ({
    type: 'member',
    username: i.username,
  }))

export const renderItem = (teamname: string, row: {username: string}) => (
  <MemberRow teamname={teamname} username={row.username} key={row.username} />
)
