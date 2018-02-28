// @flow
import * as I from 'immutable'
import {type TypedState, connect} from '../../../util/container'
import {RequestsAndInvites} from '.'

export type OwnProps = {
  teamname: string,
}

const mapStateToProps = (state: TypedState, {teamname}: OwnProps) => ({
  _invites: state.entities.getIn(['teams', 'teamNameToInvites', teamname], I.Set()),
  _requests: state.entities.getIn(['teams', 'teamNameToRequests', teamname], I.Set()),
})

const mergeProps = (stateProps, dispatchProps, {teamname}: OwnProps) => {
  const requests = stateProps._requests.toArray()
  const invites = stateProps._invites.toArray()
  const requestProps = requests.map(req => ({
    key: req.username,
    teamname,
    type: 'invites',
    subtype: 'request',
    username: req.username,
  }))
  const inviteProps = invites.map(invite => {
    if (!(invite.name || invite.email || invite.username)) {
      console.warn(`Could not find name, email, or username in invite with ID ${invite.id}`)
    }
    return {
      name: invite.name || undefined,
      email: invite.email || undefined,
      teamname,
      username: invite.username,
      id: invite.id,
      type: 'invites',
      subtype: 'invite',
      key: invite.id,
    }
  })
  let requestsAndInvites = []
  if (requestProps.length > 0) {
    requestsAndInvites.push({key: 'Requests', type: 'invites', subtype: 'divider'}, ...requestProps)
  }
  if (inviteProps.length > 0) {
    requestsAndInvites.push({key: 'Invites', type: 'invites', subtype: 'divider'}, ...inviteProps)
  }
  if (requestsAndInvites.length === 0) {
    requestsAndInvites.push({key: 'noRequestsOrInvites', type: 'invites', subtype: 'none'})
  }
  return {requestsAndInvites}
}

const listMergeProps = (stateProps, dispatchProps, ownProps) => ({
  listItems: mergeProps(stateProps, dispatchProps, ownProps).requestsAndInvites,
  ...ownProps,
})

export default connect(mapStateToProps, () => ({}), mergeProps)(RequestsAndInvites)
export const requestsAndInvitesListItemsConnector = connect(mapStateToProps, () => ({}), listMergeProps)
