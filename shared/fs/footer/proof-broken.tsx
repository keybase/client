import * as Kb from '../../common-adapters'
import type * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'

type Props = {
  path: Types.Path
}

const ProofBroken = (props: Props) => {
  const infoMap = Container.useSelector(state => state.users.infoMap)
  const users = Constants.getUsernamesFromPath(props.path).filter(
    username => (infoMap.get(username) || {broken: false}).broken
  )
  return <Kb.ProofBrokenBanner users={users} />
}

export default ProofBroken
