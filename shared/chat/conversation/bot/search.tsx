/* eslint-disable react-hooks/exhaustive-deps */
import * as React from 'react'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as BotsGen from '../../../actions/bots-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import debounce from 'lodash/debounce'

type Props = Container.RouteProps<{conversationIDKey?: Types.ConversationIDKey}>

const SearchBotPopup = (props: Props) => {
  const conversationIDKey = Container.getRouteProps(props, 'conversationIDKey', undefined)

  // dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  const onSearch = debounce((query: string) => {
    dispatch(BotsGen.createSearchFeaturedAndUsers({query}))
  }, 200)
  return (
    <Kb.Modal
      header={{
        leftButton: (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            {'Cancel'}
          </Kb.Text>
        ),
        title: 'Add a bot',
      }}
    >
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.SearchFilter
          size="full-width"
          focusOnMount={true}
          onChange={onSearch}
          placeholderText="Search bots and users..."
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

export default SearchBotPopup
