import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {makeInsertMatcher} from '@/util/string'

type Props = {
  allSelected: boolean
  channelMetas: ReadonlyMap<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>
  installInConvs: ReadonlyArray<string>
  setAllSelected: (all: boolean) => void
  setChannelPickerScreen: (show: boolean) => void
  setInstallInConvs: (convs: ReadonlyArray<string>) => void
  setDisableDone: (disable: boolean) => void
  teamID: T.Teams.TeamID
  teamName: string
}

const getChannels = (
  channelMetas: ReadonlyMap<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>,
  searchText: string
) => {
  const matcher = makeInsertMatcher(searchText)
  const regex = new RegExp(searchText, 'i')
  return [...channelMetas.values()]
    .filter(({channelname, description}) => {
      if (!searchText) {
        return true // no search text means show all
      }
      return (
        // match channel name for search as subsequence (like the identity modal)
        // match channel desc by strict substring (less noise in results)
        channelname.search(matcher) !== -1 || description.search(regex) !== -1
      )
    })
    .sort((a, b) => a.channelname.localeCompare(b.channelname))
}

const toggleChannel = (convID: string, installInConvs: ReadonlyArray<string>) => {
  if (installInConvs.includes(convID)) {
    return installInConvs.filter(id => id !== convID)
  } else {
    return installInConvs.concat([convID])
  }
}

type RowProps = {
  description: string
  disabled: boolean
  name: string
  onToggle: () => void
  selected: boolean
}
const Row = ({description, disabled, name, onToggle, selected}: RowProps) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.ListItem
      type="Small"
      firstItem={false}
      body={
        <Kb.Box2 direction="vertical" flex={1} style={disabled ? {opacity: 0.4} : undefined}>
          <Kb.Box2 direction="horizontal" alignSelf="flex-start">
            <Kb.Text lineClamp={1} type="Body" style={styles.channelHash}>
              #
            </Kb.Text>
            <Kb.Text type="Body" style={styles.channelText}>
              {name}
            </Kb.Text>
          </Kb.Box2>
          {!!description && (
            <Kb.Text type="Body" lineClamp={1} style={{color: theme.black_50}}>
              {description}
            </Kb.Text>
          )}
        </Kb.Box2>
      }
      onClick={disabled ? undefined : onToggle}
      action={
        <Kb.CheckCircle
          checked={selected}
          onCheck={disabled ? undefined : onToggle}
          disabled={disabled}
          disabledColor={selected ? theme.black_20OrWhite_20 : undefined}
        />
      }
    />
  )
}
const ChannelPicker = (props: Props) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const {allSelected, channelMetas, installInConvs, setAllSelected} = props
  const {setDisableDone, setInstallInConvs, teamName} = props
  const [searchText, setSearchText] = React.useState('')

  React.useEffect(() => {
    if (!allSelected && installInConvs.length === 0) {
      setDisableDone(true)
      return
    }
    setDisableDone(false)
  }, [allSelected, installInConvs, setDisableDone])

  const channels = getChannels(channelMetas, searchText)
  const rows = channels.map(meta => (
    <Row
      disabled={allSelected}
      key={meta.conversationIDKey}
      onToggle={() => setInstallInConvs(toggleChannel(meta.conversationIDKey, installInConvs))}
      selected={installInConvs.includes(meta.conversationIDKey) || allSelected}
      name={meta.channelname}
      description={meta.description}
    />
  ))

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.SearchFilter
          size="full-width"
          icon="iconfont-search"
          placeholderText={`Search channels in ${teamName}`}
          placeholderCentered={true}
          onChange={setSearchText}
          style={styles.searchFilter}
          focusOnMount={true}
        />
      </Kb.Box2>
      <Kb.ScrollView style={styles.rowsContainer}>
        <Kb.Box2 direction="horizontal" style={{backgroundColor: theme.blueGrey}}>
          <Kb.ListItem
            type="Small"
            firstItem={true}
            body={<Kb.Text type="BodyBold">All channels</Kb.Text>}
            onClick={() => setAllSelected(!allSelected)}
            action={<Kb.CheckCircle checked={allSelected} onCheck={() => setAllSelected(!allSelected)} />}
          />
        </Kb.Box2>
        {rows}
      </Kb.ScrollView>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      channelHash: {
        alignSelf: 'center',
        color: theme.black_50,
        flexShrink: 0,
        marginRight: Kb.Styles.globalMargins.xtiny,
      },
      channelText: Kb.Styles.platformStyles({
        isElectron: {
          wordBreak: 'break-all',
        },
      }),
      // the rows have to scroll inside the modal instead of growing it
      container: {
        flexGrow: 1,
        flexShrink: 1,
        minHeight: 0,
      },
      rowsContainer: {
        ...Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
        flexGrow: 1,
        flexShrink: 1,
        minHeight: 0,
      },
      searchFilter: Kb.Styles.platformStyles({
        common: {
          marginBottom: Kb.Styles.globalMargins.xsmall,
          marginTop: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {
          ...Kb.Styles.marginH(Kb.Styles.globalMargins.small),
        },
      }),
    }) as const
)

export default ChannelPicker
