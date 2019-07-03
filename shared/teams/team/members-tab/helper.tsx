import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as Constants from '../../../constants/teams'
import {TypedState} from '../../../util/container'
import * as I from 'immutable'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import MemberRow from './member-row/container'

export type OwnProps = {
  teamname: string
}

// Weights for sorting team members
// 2 is neutral
// lower values come earlier

const order = {admin: 3, owner: 2, reader: 5, writer: 4}

const getWeights = (manageMembers: boolean) => {
  // only weigh actionable statuses higher if we can effect them
  const statusWeights = manageMembers
    ? {
        active: 2,
        deleted: 0,
        reset: 1,
      }
    : {
        active: 2,
        deleted: 2,
        reset: 2,
      }
  return {
    ...order,
    ...statusWeights,
  }
}

const getOrderedMemberArray = (
  memberInfo: I.Map<string, Types.MemberInfo>,
  you: string | null,
  yourOperations: RPCTypes.TeamOperation
): Array<Types.MemberInfo> => {
  let returnArray = memberInfo
    .valueSeq()
    .toArray()
    .sort((a, b) => {
      // Get listFirst out of the way
      if (yourOperations.listFirst && a.username === you) {
        return -1
      } else if (yourOperations.listFirst && b.username === you) {
        return 1
      }

      const weights = getWeights(yourOperations.manageMembers)
      // Diff the statuses then types. If they're both the same sort alphabetically
      const diff1 = weights[a.status] - weights[b.status]
      const diff2 = weights[a.type] - weights[b.type]
      return diff1 || diff2 || a.username.localeCompare(b.username)
    })

  return returnArray
}

type StateProps = {
  _memberInfo: I.Map<string, Types.MemberInfo>
  _you: string | null
  _yourOperations: RPCTypes.TeamOperation
}

/* Helpers to build the teams tabs. mapStateHelper is called by the master mapStateToProps, getRows makes the rows to be injected below the header, renderItem renders the individual row */
export const mapStateHelper = (
  state: TypedState,
  ownProps: {
    teamname: string
  }
): StateProps => ({
  _memberInfo: Constants.getTeamMembers(state, ownProps.teamname),
  _you: state.config.username || '',
  _yourOperations: Constants.getCanPerform(state, ownProps.teamname),
})

export const getRows = ({_memberInfo, _you, _yourOperations}: StateProps) =>
  getOrderedMemberArray(_memberInfo, _you, _yourOperations).map(i => ({
    type: 'member',
    username: i.username,
  }))

export const renderItem = (
  teamname: string,
  row: {
    username: string
  }
) => <MemberRow teamname={teamname} username={row.username} key={row.username} />
