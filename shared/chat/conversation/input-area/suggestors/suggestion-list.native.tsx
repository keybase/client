import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import {NativeFlatList} from '../../../../common-adapters/native-wrappers.native'
import * as Styles from '../../../../styles'
import {Props} from './suggestion-list'

const SuggestionList = (props: Props) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    style={Styles.collapseStyles([styles.listContainer, props.style])}
  >
    <NativeFlatList
      alwaysBounceVertical={false}
      renderItem={({index, item}) => props.renderItem(index, item)}
      style={styles.noGrow}
      data={props.items}
      keyExtractor={props.keyExtractor || (item => item)}
      keyboardShouldPersistTaps="always"
      windowSize={10}
    />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  listContainer: {flexGrow: 0, marginTop: 'auto'},
  noGrow: {flexGrow: 0},
})

export default SuggestionList
