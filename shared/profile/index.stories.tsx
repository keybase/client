import confirmOrPending from './confirm-or-pending/index.stories'
import editAvatar from './edit-avatar/index.stories'
import folders from './folders/index.stories'
import genericProofs from './generic/index.stories'
import postProof from './post-proof/index.stories'
import proveEnter from './prove-enter-username/index.stories'
import proveWebsite from './prove-website-choice/index.stories'
import revoke from './revoke/index.stories'
import profile from './profile.stories'
import teamInfo from './user/teams/teaminfo.stories'
import wotAuthor from './wot-author/index.stories'

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
    teamInfo,
    wotAuthor,
  ].forEach(load => load())
}

export default load
