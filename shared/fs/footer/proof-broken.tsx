import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'

type Props = {path: T.FS.Path}

const ProofBroken = (props: Props) => {
  const infoMap = C.useUsersState(s => s.infoMap)
  const users = C.FS.getUsernamesFromPath(props.path).filter(
    username => (infoMap.get(username) || {broken: false}).broken
  )
  return <Kb.ProofBrokenBanner users={users} />
}

export default ProofBroken
