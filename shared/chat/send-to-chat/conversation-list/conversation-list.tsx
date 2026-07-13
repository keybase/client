import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as C from '@/constants'
import logger from '@/logger'
import debounce from 'lodash/debounce'
import {Avatars, TeamAvatar} from '@/chat/avatars'

/* This is used in Fs tab for sending attachments to chat. Please check to make
 * sure it doesn't break there if you make changes to this file. */

type Props = {
  onDone?: () => void
  onSelect: (conversationIDKey: T.Chat.ConversationIDKey, convName: string) => void
}

type RowProps = {
  isSelected: boolean
  item: T.RPCChat.SimpleSearchInboxConvNamesHit
  onSelectItem: (item: T.RPCChat.SimpleSearchInboxConvNamesHit) => void
}

// React.memo, not just compiler memo: the list calls renderItem outside the
// compiler's memo graph, so the shallow prop bail is what lets rows skip when
// only the selection or result batch changes
const Row = React.memo(function Row(p: RowProps) {
  const {isSelected, item, onSelectItem} = p
  return (
    <Kb.ClickableBox
      onClick={() => onSelectItem(item)}
      direction="horizontal"
      fullWidth={true}
      gap="tiny"
      style={Kb.Styles.collapseStyles([
        styles.results,
        {
          backgroundColor:
            !isMobile && isSelected ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.white,
        },
      ])}
    >
      {item.isTeam ? (
        <TeamAvatar isHovered={false} isMuted={false} isSelected={isSelected} teamname={item.tlfName} />
      ) : (
        <Avatars isSelected={isSelected} participantOne={item.parts?.[0]} participantTwo={item.parts?.[1]} />
      )}
      <Kb.Text type="Body" style={{alignSelf: 'center'}} lineClamp={1}>
        {item.name}
      </Kb.Text>
    </Kb.ClickableBox>
  )
})

const ConversationList = (props: Props) => {
  const [query, setQuery] = React.useState('')
  const [waiting, setWaiting] = React.useState(false)
  const [selected, setSelected] = React.useState(0)
  const [results, setResults] = React.useState<ReadonlyArray<T.RPCChat.SimpleSearchInboxConvNamesHit>>([])
  const submit = C.useRPC(T.RPCChat.localSimpleSearchInboxConvNamesRpcPromise)
  const [lastQuery, setLastQuery] = React.useState('init')
  if (lastQuery !== query) {
    setLastQuery(query)
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
  }
  const onSelect = (convID: T.Chat.ConversationIDKey, convName: string) => {
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
  results: ReadonlyArray<T.RPCChat.SimpleSearchInboxConvNamesHit>
  setQuery: (query: string) => void
  onSelect: (conversationIDKey: T.Chat.ConversationIDKey, convName: string) => void
}

const ConversationListRender = (props: ConversationListRenderProps) => {
  const {selected, setSelected, results, onSelect} = props
  const onSelectItem = React.useEffectEvent((item: T.RPCChat.SimpleSearchInboxConvNamesHit) =>
    onSelect(T.Chat.conversationIDToKey(item.convID), item.tlfName)
  )
  const renderItem = (index: number, item: T.RPCChat.SimpleSearchInboxConvNamesHit) => (
    <Row key={index} item={item} isSelected={index === selected} onSelectItem={onSelectItem} />
  )
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} flex={1}>
      <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.filterContainer}>
        <Kb.SearchFilter
          placeholderText="Search chats..."
          onChange={debounce(props.setQuery, 200)}
          size="small"
          icon="iconfont-search"
          waiting={props.waiting}
          focusOnMount={false}
          onKeyDown={(e: React.KeyboardEvent) => {
            switch (e.key) {
              case 'ArrowDown':
                if (selected < results.length - 1) {
                  setSelected(selected + 1)
                }
                break
              case 'ArrowUp':
                if (selected > 0) {
                  setSelected(selected - 1)
                }
                break
              case 'Enter':
                if (results.length > 0) {
                  const result = results[selected]
                  // consumers use this as the tlf name (upload tlfName), not the display name
                  onSelect(
                    result?.convID ? T.Chat.conversationIDToKey(result.convID) : '',
                    result?.tlfName ?? ''
                  )
                }
                break
            }
          }}
        />
      </Kb.Box2>
      <Kb.List
        itemHeight={{height: 65, type: 'fixed'}}
        items={results as Array<T.RPCChat.SimpleSearchInboxConvNamesHit>}
        renderItem={renderItem}
        indexAsKey={true}
      />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      filterContainer: Kb.Styles.platformStyles({
        isElectron: {
          padding: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.tiny,
        },
      }),
      results: Kb.Styles.platformStyles({
        common: {
          padding: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.tiny,
        },
      }),
    }) as const
)

export default ConversationList
