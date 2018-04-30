// @flow
import error from './error/index.stories'
import invitecode from './invite-code/index.stories'
import passphrase from './passphrase/index.stories'
import requestInviteSuccess from './request-invite-success/index.stories'
import requestInvite from './request-invite/index.stories'
import success from './success/index.stories'
import usernameEmailForm from './username-email-form/index.stories'

const load = () => {
  ;[error, invitecode, passphrase, requestInviteSuccess, requestInvite, success, usernameEmailForm].forEach(
    load => load()
  )
}

export default load
