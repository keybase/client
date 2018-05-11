// @flow
import * as React from 'react'
import {InfoNote, Text} from '../../common-adapters'
import {globalMargins, desktopStyles, platformStyles, styleSheetCreate} from '../../styles'

export type Props = {
  onReadMore: () => void,
}

const BetaNote = (props: Props) => (
  <InfoNote containerStyle={styles.container}>
    <Text
      type="BodySmallSemibold"
      className="hover-underline"
      onClick={props.onReadMore}
      style={platformStyles({isElectron: {...desktopStyles.clickable}})}
    >
      Read more about teams here
    </Text>
  </InfoNote>
)

const styles = styleSheetCreate({
  container: {
    marginBottom: globalMargins.small,
    marginLeft: globalMargins.medium,
    marginRight: globalMargins.medium,
    marginTop: globalMargins.small,
  },
})

export default BetaNote
