// @flow
import deleteConfirm from './delete-confirm/index.stories'
import deleteMe from './delete/index.stories'
import email from './email/index.stories'
import inviteGenerated from './invite-generated/index.stories'
import invites from './invites/index.stories'
import nav from './nav/index.stories'
import notifications from './notifications/index.stories'
import passphrase from './passphrase/index.stories'
import chat from './chat/index.stories'

const load = () => {
  ;[email, passphrase, deleteMe, deleteConfirm, notifications, inviteGenerated, invites, nav, chat].forEach(
    load => load()
  )
}

export default load
