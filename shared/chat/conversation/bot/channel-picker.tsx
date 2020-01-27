import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as TeamTypes from '../../../constants/types/teams'
import {memoize} from '../../../util/memoize'
import {makeInsertMatcher} from '../../../util/string'

type Props = {
  channelInfos: Map<string, TeamTypes.ChannelInfo>
  installInConvs: string[]
  setChannelPickerScreen: (show: boolean) => void
  setInstallInConvs: (convs: string[]) => void
  teamID: TeamTypes.TeamID
  teamName: string
}

const getChannels = memoize((channelInfos: Map<string, TeamTypes.ChannelInfo>, searchText: string) =>
  [...channelInfos.entries()]
    .filter(([_, channelInfo]) => {
      if (!searchText) {
        return true // no search text means show all
      }
      return (
        // match channel name for search as subsequence (like the identity modal)
        // match channel desc by strict substring (less noise in results)
        channelInfo.channelname.match(makeInsertMatcher(searchText)) ||
        channelInfo.description.match(new RegExp(searchText, 'i'))
      )
    })
    .sort((a, b) => a[1].channelname.localeCompare(b[1].channelname))
)

const toggleChannel = (convID: string, installInConvs: string[]) => {
  if (installInConvs.includes(convID)) {
    return installInConvs.filter(id => id !== convID)
  } else {
    return installInConvs.concat([convID])
  }
}

type RowProps = {
  onToggle: () => void
  selected: boolean
  channelInfo: TeamTypes.ChannelInfo
}
const Row = ({onToggle, selected, channelInfo}: RowProps) => (
  <Kb.Box2
    direction="horizontal"
    alignSelf="flex-start"
    style={{marginBottom: Styles.globalMargins.tiny}}
    fullWidth={true}
  >
    <Kb.Checkbox checked={selected} label="" onCheck={onToggle} style={styles.channelCheckbox} />

    <Kb.Box2 direction="vertical" style={{flex: 1}}>
      <Kb.Box2 direction="horizontal" alignSelf="flex-start">
        <Kb.Text lineClamp={1} type="Body" style={styles.channelHash}>
          #
        </Kb.Text>
        <Kb.Text type="Body" style={styles.channelText}>
          {channelInfo.channelname}
        </Kb.Text>
      </Kb.Box2>
      {!!channelInfo.description && (
        <Kb.Text type="Body" lineClamp={1} style={{color: Styles.globalColors.black_50}}>
          {channelInfo.description}
        </Kb.Text>
      )}
    </Kb.Box2>
  </Kb.Box2>
)
const ChannelPicker = (props: Props) => {
  const {channelInfos, installInConvs, setInstallInConvs} = props
  const [searchText, setSearchText] = React.useState('')

  const rows = getChannels(channelInfos, searchText).map(([convID, channelInfo]) => (
    <Row
      key={convID}
      onToggle={() => setInstallInConvs(toggleChannel(convID, installInConvs))}
      selected={installInConvs.includes(convID)}
      channelInfo={channelInfo}
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
      <Kb.ScrollView style={styles.rowsContainer}>{rows}</Kb.ScrollView>
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
