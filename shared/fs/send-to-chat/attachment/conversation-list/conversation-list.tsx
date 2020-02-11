import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Types from '../../../../constants/types/chat2'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Container from '../../../../util/container'
import * as Styles from '../../../../styles'
import {rowHeight} from '../../../../chat/selectable-big-team-channel'
import {rowHeight as shouldEqualToRowHeight} from '../../../../chat/selectable-small-team'
import logger from '../../../../logger'
import debounce from 'lodash/debounce'
import {Avatars, TeamAvatar} from '../../../../chat/avatars'

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
          <TeamAvatar
            isHovered={false}
            isMuted={false}
            isSelected={row.isSelected}
            teamname={item.teamName}
          />
        ) : (
          <Avatars
            isHovered={false}
            isLocked={false}
            isMuted={false}
            isSelected={row.isSelected}
            participants={item.parts ?? []}
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

  if (rowHeight !== shouldEqualToRowHeight) {
    // Sanity check, in case this changes in the future
    return <Kb.Text type="BodyBigExtrabold">item size changes, should use use variable size list</Kb.Text>
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.filterContainer}>
        <Kb.SearchFilter
          placeholderText="Search"
          onChange={debounce(setQuery, 200)}
          size="small"
          icon="iconfont-search"
          waiting={waiting}
          focusOnMount={true}
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
                  onSelect(Types.conversationIDToKey(result.convID), result.name)
                }
                break
            }
          }}
        />
      </Kb.Box2>
      <Kb.List2
        itemHeight={{height: rowHeight, type: 'fixed'}}
        items={results.map((r, index) => ({
          isSelected: index === selected,
          item: r,
          onSelect: () => onSelect(Types.conversationIDToKey(r.convID), r.name),
        }))}
        renderItem={_itemRenderer}
        indexAsKey={true}
      />
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
      moreLessContainer: {
        height: rowHeight,
      },
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
