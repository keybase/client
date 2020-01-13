import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

const BotTeamPicker = () => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.SearchFilter
          size="full-width"
          icon="iconfont-search"
          placeholderText={`Search channels in ${props.teamName}`}
          placeholderCentered={true}
          mobileCancelButton={true}
          hotkey="f"
          onChange={setSearchText}
          style={styles.searchFilter}
        />
      </Kb.Box2>
      <Kb.ScrollView style={styles.rowsContainer}>{rows}</Kb.ScrollView>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
