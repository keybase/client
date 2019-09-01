import * as React from 'react'
import * as Kb from '../../../../../../common-adapters/index'
import * as Types from '../../../../../../constants/types/chat2'
import * as Container from '../../../../../../util/container'
import * as RouteTreeGen from '../../../../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../../../../actions/chat2-gen'
import openURL from '../../../../../../util/open-url'
import HiddenString from '../../../../../../util/hidden-string'
import {imgMaxHeightRaw, imgMaxWidthRaw} from '../../../attachment/image/image-render'

type Props = {
  converstionIDKey: Types.ConversationIDKey
  coord: Types.Coordinate
  isAuthor: boolean
  url: string
}

const UnfurlMapPopup = (props: Props) => {
  const {conversationIDKey, coord, isAuthor, url} = props
  // state
  const {httpSrvAddress, httpSrvToken} = Container.useSelector(state => ({
    httpSrvAddress: state.config.httpSrvAddress,
    httpSrvToken: state.config.httpSrvToken,
  }))
  //dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  const onViewURL = () => {
    onClose()
    openURL(url)
  }
  const onStopSharing = () => {
    onClose()
    dispatch(
      Chat2Gen.createMessageSend({
        conversationIDKey,
        text: new HiddenString('/location stop'),
      })
    )
  }

  // render
  const width = imgMaxWidthRaw()
  const height = imgMaxHeightRaw() - 320
}
