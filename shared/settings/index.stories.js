// @flow
import email from './email/index.stories'
// import passphrase from './passphrase/index.stories'
// import delete from './delete/index.stories'
// import deleteConfirm from './delete-confirm/index.stories'
// import notifications from './notifications/index.stories'
// import inviteGenerated from './invite-generated/index.stories'
// import invites from './invites/index.stories'

const load = () => {
  ;[
    email,
    // passphrase,
    // delete,
    // deleteConfirm,
    // notifications,
    // inviteGenerated,
    // invites,
  ].forEach(load => load())
}

export default load
