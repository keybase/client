import confirmOrPending from './confirm-or-pending/index.stories'
import editAvatar from './edit-avatar/index.stories'
import folders from './folders/index.stories'
import genericProofs from './generic/index.stories'
import postProof from './post-proof/index.stories'
import proveEnter from './prove-enter-username/index.stories'
import proveWebsite from './prove-website-choice/index.stories'
import revoke from './revoke/index.stories'
import block from './block/index.stories'
import search from './search/index.stories'
import profile from './profile.stories'

const load = () => {
  ;[
    confirmOrPending,
    editAvatar,
    folders,
    genericProofs,
    postProof,
    profile,
    proveEnter,
    proveWebsite,
    revoke,
    block,
    search,
  ].forEach(load => load())
}

export default load
