import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type * as TeamTypes from '../../../constants/types/teams'
import type * as Types from '../../../constants/types/chat2'
import {memoize} from '../../../util/memoize'
import {makeInsertMatcher} from '../../../util/string'

type Props = {
  channelMetas: Map<Types.ConversationIDKey, Types.ConversationMeta>
  installInConvs: string[]
  setChannelPickerScreen: (show: boolean) => void
  setInstallInConvs: (convs: string[]) => void
  setDisableDone: (disable: boolean) => void
  teamID: TeamTypes.TeamID
  teamName: string
}

const getChannels = memoize(
  (channelMetas: Map<Types.ConversationIDKey, Types.ConversationMeta>, searchText: string) => {
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
          channelname.match(matcher) || description.match(regex)
        )
      })
      .sort((a, b) => a.channelname.localeCompare(b.channelname))
  }
)

const toggleChannel = (convID: string, installInConvs: string[]) => {
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
const Row = ({description, disabled, name, onToggle, selected}: RowProps) => (
  <Kb.ListItem2
    type="Small"
    firstItem={false}
    body={
      <Kb.Box2 direction="vertical" style={Styles.collapseStyles([{flex: 1}, disabled && {opacity: 0.4}])}>
        <Kb.Box2 direction="horizontal" alignSelf="flex-start">
          <Kb.Text lineClamp={1} type="Body" style={styles.channelHash}>
            #
          </Kb.Text>
          <Kb.Text type="Body" style={styles.channelText}>
            {name}
          </Kb.Text>
        </Kb.Box2>
        {!!description && (
          <Kb.Text type="Body" lineClamp={1} style={{color: Styles.globalColors.black_50}}>
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
        disabledColor={selected ? Styles.globalColors.black_20OrWhite_20 : undefined}
      />
    }
  />
)
const ChannelPicker = (props: Props) => {
  const {installInConvs, setInstallInConvs, setDisableDone} = props
  const [allSelected, setAllSelected] = React.useState(installInConvs.length === 0)
  const [searchText, setSearchText] = React.useState('')
  React.useEffect(() => {
    if (allSelected) {
      setInstallInConvs([])
    }
  }, [allSelected, setInstallInConvs])

  React.useEffect(() => {
    if (!allSelected && installInConvs.length === 0) {
      setDisableDone(true)
      return
    }
    setDisableDone(false)
  }, [allSelected, installInConvs, setDisableDone])

  const rows = getChannels(props.channelMetas, searchText).map(meta => (
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
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.SearchFilter
          size="full-width"
          icon="iconfont-search"
          placeholderText={`Search channels in ${props.teamName}`}
          placeholderCentered={true}
          onChange={setSearchText}
          style={styles.searchFilter}
          focusOnMount={true}
        />
      </Kb.Box2>
      <Kb.ScrollView style={styles.rowsContainer}>
        <Kb.Box2 direction="horizontal" style={{backgroundColor: Styles.globalColors.blueGrey}}>
          <Kb.ListItem2
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      channelCheckbox: {
        marginRight: Styles.globalMargins.tiny,
        paddingTop: 0,
      },
      channelHash: {
        alignSelf: 'center',
        color: Styles.globalColors.black_50,
        flexShrink: 0,
        marginRight: Styles.globalMargins.xtiny,
      },
      channelText: Styles.platformStyles({
        isElectron: {
          wordBreak: 'break-all',
        },
      }),
      rowsContainer: Styles.platformStyles({
        common: {
          ...Styles.padding(0, Styles.globalMargins.small),
        },
        isElectron: {
          minHeight: 370,
        },
      }),
      searchFilter: Styles.platformStyles({
        common: {
          marginBottom: Styles.globalMargins.xsmall,
          marginTop: Styles.globalMargins.tiny,
        },
        isElectron: {
          marginLeft: Styles.globalMargins.small,
          marginRight: Styles.globalMargins.small,
        },
      }),
    } as const)
)

export default ChannelPicker
