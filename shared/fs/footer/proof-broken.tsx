import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import * as FS from '@/stores/fs'
import {useUsersState} from '@/stores/users'

type Props = {path: T.FS.Path}

const ProofBroken = (props: Props) => {
  const infoMap = useUsersState(s => s.infoMap)
  const users = FS.getUsernamesFromPath(props.path).filter(
    username => (infoMap.get(username) || {broken: false}).broken
  )
  return <Kb.ProofBrokenBanner users={users} />
}

export default ProofBroken
