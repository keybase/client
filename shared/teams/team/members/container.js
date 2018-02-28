// @flow
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as I from 'immutable'
import {type TypedState, connect} from '../../../util/container'
import {Members} from '.'

export type OwnProps = {
  teamname: string,
}

const order = {owner: 0, admin: 1, writer: 2, reader: 3}

const getOrderedMemberArray = (
  memberInfo: I.Set<Types.MemberInfo>,
  you: ?string,
  listYouFirst: boolean
): Array<Types.MemberInfo> => {
  let youInfo
  let info = memberInfo
  if (you && !listYouFirst) {
    youInfo = memberInfo.find(member => member.username === you)
    if (youInfo) {
      info = memberInfo.delete(youInfo)
    }
  }
  let returnArray = info.toArray().sort((a, b) => {
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

  if (youInfo) {
    returnArray.unshift(youInfo)
  }
  return returnArray
}

const mapStateToProps = (state: TypedState, {teamname}: OwnProps) => ({
  // Assume teamname exists here because parent throws an error if not.
  _memberInfo: state.entities.getIn(['teams', 'teamNameToMembers', teamname], I.Set()),
  you: state.config.username,
  yourOperations: Constants.getCanPerform(state, teamname),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const _members = getOrderedMemberArray(
    stateProps._memberInfo,
    stateProps.you,
    stateProps.yourOperations.listFirst
  )
  return {
    members: _members.map(member => ({
      type: 'member',
      fullName: member.fullName,
      username: member.username,
      teamname: ownProps.teamname,
      active: member.active,
      key: member.username + member.active.toString(),
    })),
  }
}

const listMergeProps = (stateProps, dispatchProps, ownProps) => ({
  listItems: mergeProps(stateProps, dispatchProps, ownProps).members,
  ...ownProps,
})

export default connect(mapStateToProps, () => ({}), mergeProps)(Members)
export const membersListItemsConnector = connect(mapStateToProps, () => ({}), listMergeProps)
