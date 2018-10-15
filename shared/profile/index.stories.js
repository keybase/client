// @flow
import confirmOrPending from './confirm-or-pending/index.stories'
import editAvatar from './edit-avatar/index.stories'
import editProfile from './edit-profile/index.stories'
import folders from './folders/index.stories'
import pgp from './pgp/index.stories'
import postProof from './post-proof/index.stories'
import profile from './profile.stories'
import proveEnter from './prove-enter-username/index.stories'
import proveWebsite from './prove-website-choice/index.stories'
import revoke from './revoke/index.stories'
import search from './search/index.stories'

const load = () => {
  ;[
    confirmOrPending,
    editAvatar,
    editProfile,
    folders,
    pgp,
    postProof,
    profile,
    proveEnter,
    proveWebsite,
    revoke,
    search,
  ].forEach(load => load())
}

export default load
