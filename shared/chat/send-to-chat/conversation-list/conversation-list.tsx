import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/chat2'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Container from '../../../util/container'
import * as Styles from '../../../styles'
import logger from '../../../logger'
import debounce from 'lodash/debounce'
import {Avatars, TeamAvatar} from '../../avatars'

/* This is used in Fs tab for sending attachments to chat. Please check to make
 * sure it doesn't break there if you make changes to this file. */

type Props = {
  onDone?: () => void
  onSelect: (conversationIDKey: Types.ConversationIDKey, convName: string) => void
}

type Row = {
  isSelected: boolean
  item: RPCChatTypes.SimpleSearchInboxConvNamesHit
  onSelect: () => void
}

const _itemRenderer = (index: number, row: Row) => {
  const item = row.item
  return (
    <Kb.ClickableBox key={index} onClick={row.onSelect}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        gap="tiny"
        style={Styles.collapseStyles([
          styles.results,
          {
            backgroundColor:
              !Styles.isMobile && row.isSelected ? Styles.globalColors.blue : Styles.globalColors.white,
          },
        ])}
      >
        {item.isTeam ? (
          <TeamAvatar isHovered={false} isMuted={false} isSelected={row.isSelected} teamname={item.tlfName} />
        ) : (
          <Avatars
            isSelected={row.isSelected}
            participantOne={item.parts?.[0]}
            participantTwo={item.parts?.[1]}
          />
        )}
        <Kb.Text type="Body" style={{alignSelf: 'center'}} lineClamp={1}>
          {item.name}
        </Kb.Text>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const ConversationList = (props: Props) => {
  const [query, setQuery] = React.useState('')
  const [waiting, setWaiting] = React.useState(false)
  const [selected, setSelected] = React.useState(0)
  const [results, setResults] = React.useState<Array<RPCChatTypes.SimpleSearchInboxConvNamesHit>>([])
  const submit = Container.useRPC(RPCChatTypes.localSimpleSearchInboxConvNamesRpcPromise)
  const doSearch = React.useCallback(() => {
    setWaiting(true)
    setSelected(0)
    submit(
      [{query}],
      result => {
        setWaiting(false)
        setResults(result ?? [])
      },
      error => {
        setWaiting(false)
        logger.info('ConversationList: error loading search results: ' + error.message)
      }
    )
  }, [query, submit])
  React.useEffect(() => {
    doSearch()
  }, [doSearch])
  const onSelect = (convID: Types.ConversationIDKey, convName: string) => {
    props.onSelect(convID, convName)
    props.onDone?.()
  }
  return (
    <ConversationListRender
      selected={selected}
      setSelected={setSelected}
      waiting={waiting}
      results={results}
      setQuery={setQuery}
      onSelect={onSelect}
    />
  )
}

type ConversationListRenderProps = {
  selected: number
  setSelected: (selected: number) => void
  waiting: boolean
  results: Array<RPCChatTypes.SimpleSearchInboxConvNamesHit>
  setQuery: (query: string) => void
  onSelect: (conversationIDKey: Types.ConversationIDKey, convName: string) => void
}

export const ConversationListRender = (props: ConversationListRenderProps) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={{flex: 1}}>
      <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.filterContainer}>
        <Kb.SearchFilter
          placeholderText="Search chats..."
          onChange={debounce(props.setQuery, 200)}
          size="small"
          icon="iconfont-search"
          waiting={props.waiting}
          focusOnMount={true}
          onKeyDown={(e: React.KeyboardEvent) => {
            switch (e.key) {
              case 'ArrowDown':
                if (props.selected < props.results.length - 1) {
                  props.setSelected(props.selected + 1)
                }
                break
              case 'ArrowUp':
                if (props.selected > 0) {
                  props.setSelected(props.selected - 1)
                }
                break
              case 'Enter':
                if (props.results.length > 0) {
                  const result = props.results[props.selected]
                  props.onSelect(Types.conversationIDToKey(result.convID), result.name)
                }
                break
            }
          }}
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={{flex: 1}}>
        <Kb.List2
          itemHeight={{height: 65, type: 'fixed'}}
          items={props.results.map((r, index) => ({
            isSelected: index === props.selected,
            item: r,
            onSelect: () => props.onSelect(Types.conversationIDToKey(r.convID), r.tlfName),
          }))}
          renderItem={_itemRenderer}
          indexAsKey={true}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      filterContainer: Styles.platformStyles({
        isElectron: {
          padding: Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingBottom: Styles.globalMargins.tiny,
        },
      }),
      results: Styles.platformStyles({
        common: {
          padding: Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingBottom: Styles.globalMargins.tiny,
        },
      }),
    } as const)
)

export default ConversationList
