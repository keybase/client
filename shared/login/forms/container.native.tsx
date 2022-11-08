import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {ScrollView} from 'react-native'
import {type Props} from './container'

const Container = ({children, style, outerStyle}: Props) => {
  return (
    <Kb.SimpleKeyboardAvoidingView>
      <ScrollView style={{...styles.container, ...outerStyle}}>
        <Kb.Box style={{...styles.innerContainer, ...style}}>{children}</Kb.Box>
      </ScrollView>
    </Kb.SimpleKeyboardAvoidingView>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        flexGrow: 1,
        paddingLeft: Styles.globalMargins.medium,
        paddingRight: Styles.globalMargins.medium,
      },
      innerContainer: {
        ...Styles.globalStyles.flexBoxColumn,
        flexGrow: 1,
        marginTop: Styles.globalMargins.medium,
      },
    } as const)
)

export default Container
