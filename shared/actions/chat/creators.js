// @flow
import * as Constants from '../../constants/chat'
import * as I from 'immutable'
import {chatTab} from '../../constants/tabs'
import {setRouteState} from '../route-tree'

import type {SetRouteState} from '../../constants/route-tree'

function setSelectedRouteState(
  selectedConversation: Constants.ConversationIDKey,
  partialState: Object
): SetRouteState {
  return setRouteState(I.List([chatTab, selectedConversation]), partialState)
}

export {setSelectedRouteState}
