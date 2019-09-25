import error from './error/index.stories'
import invitecode from './invite-code/index.stories'
import requestInviteSuccess from './request-invite-success/index.stories'
import requestInvite from './request-invite/index.stories'

const load = () => {
  ;[error, invitecode, requestInviteSuccess, requestInvite].forEach(load => load())
}

export default load
