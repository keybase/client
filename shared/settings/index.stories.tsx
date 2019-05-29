import account from './account/index.stories'
import deleteConfirm from './delete-confirm/index.stories'
import deleteMe from './delete/index.stories'
import email from './email/index.stories'
import inviteGenerated from './invite-generated/index.stories'
import invites from './invites/index.stories'
import nav from './nav/index.stories'
import notifications from './notifications/index.stories'
import password from './password/index.stories'
import chat from './chat/index.stories'
import landing from './landing/index.stories'
import files from './files/index.stories'

const load = () => {
  ;[
    account,
    email,
    password,
    deleteMe,
    deleteConfirm,
    notifications,
    inviteGenerated,
    invites,
    nav,
    chat,
    landing,
    files,
  ].forEach(load => load())
}

export default load
