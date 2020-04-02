import * as React from 'react'
import * as TeamsTypes from '../../constants/types/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as RPCChatGen from '../../constants/types/rpc-chat-gen'
import * as Container from '../../util/container'
import * as FsTypes from '../../constants/types/fs'
import * as ChatTypes from '../../constants/types/chat2'
import * as ChatConstants from '../../constants/chat2'
import {AliasInput, Modal} from './common'
import {pluralize} from '../../util/string'
import useRPC from '../../util/use-rpc'

type Props = {
  teamID: TeamsTypes.TeamID
}
type RoutableProps = Container.RouteProps<Props>

export const AddAliasModal = (props: Props) => null
