// @flow
import * as I from 'immutable'
import {type TypedState, connect} from '../../../util/container'
import {RequestsAndInvites} from '.'

export type OwnProps = {
  teamname: string,
}

type Request = {
  type: 'request',
  key: string,
  teamname: string,
  username: string,
}

type Invite = {
  type: 'invite',
  email?: string,
  name?: string,
  key: string,
  id: string,
  username: string,
  teamname: string,
}

type Divider = {
  type: 'divider',
  key: 'Invites' | 'Requests',
}

export type RequestOrInvite = Request | Invite | Divider

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
    type: 'request',
    username: req.username,
  }))
  const inviteProps = invites.map(invite => {
    let inviteInfo
    if (invite.name) {
      inviteInfo = {name: invite.name}
    } else if (invite.email) {
      inviteInfo = {email: invite.email}
    } else if (invite.username) {
      inviteInfo = {username: invite.username}
    } else {
      console.warn(`Could not find name, email, or username in invite with ID ${invite.id}`)
    }
    return ({
      ...inviteInfo,
      teamname,
      username: invite.username,
      id: invite.id,
      type: 'invite',
      key: invite.id,
    }: Invite)
  })
  let requestsAndInvites = []
  if (requestProps.length > 0) {
    requestsAndInvites.push({key: 'Requests', type: 'divider'}, ...requestProps)
  }
  if (inviteProps.length > 0) {
    requestsAndInvites.push({key: 'Invites', type: 'divider'}, ...inviteProps)
  }
  return {requestsAndInvites}
}

export default connect(mapStateToProps, () => ({}), mergeProps)(RequestsAndInvites)
