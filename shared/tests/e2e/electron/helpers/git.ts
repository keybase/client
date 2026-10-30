// The git repos one run's desktop git flows make: shared/git.ts's, but for the team repo, which lives
// in KB_E2E_TEAM itself here. Every write refuses a repo other than this run's own two:
// `e2e-<runid>-repo` of the smoke account and `e2e-<runid>-trepo` of KB_E2E_TEAM.
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {personalRepo, repoWrites, teamRepoName, type RepoRef} from '@/tests/e2e/shared/git'

export {personalRepo, repoListed, repoUrl, type RepoRef, type TeamRepoChat} from '@/tests/e2e/shared/git'

export const teamRepo = (): RepoRef => ({name: teamRepoName(), team: loadE2EAccounts().team})

const requireThisRunRepo = (r: RepoRef) => {
  const want = r.team === undefined ? personalRepo() : teamRepo()
  if (r.name !== want.name || r.team !== want.team) {
    throw new Error(`refusing to act on a repo that is not this run's ${r.team === undefined ? 'personal' : 'e2e team'} repo`)
  }
  return r
}

export const {deleteRepoIfPresent, teamRepoChat} = repoWrites(requireThisRunRepo)
