import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as UserConstants from '../../constants/users'
import * as Container from '../../util/container'

type Props = {
  path: Types.Path
}

const ProofBroken = (props: Props) => {
  const infoMap = Container.useSelector(state => state.users.infoMap)
  const users = Constants.getUsernamesFromPath(props.path).filter(
    username => infoMap.get(username, UserConstants.emptyUserInfo).broken
  )
  return <Kb.ProofBrokenBanner users={users} />
}

export default ProofBroken
