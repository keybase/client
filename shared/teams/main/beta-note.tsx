import * as React from 'react'
import {InfoNote, Text} from '../../common-adapters'
import {globalMargins, desktopStyles, platformStyles, styleSheetCreate} from '../../styles'

export type Props = {
  onReadMore: () => void
}

const BetaNote = (props: Props) => (
  <InfoNote containerStyle={styles.container}>
    <Text
      type="BodySmallSecondaryLink"
      className="hover-underline"
      onClick={props.onReadMore}
      style={platformStyles({isElectron: {...desktopStyles.clickable}})}
    >
      Read more about teams
    </Text>
  </InfoNote>
)

const styles = styleSheetCreate({
  container: {
    margin: globalMargins.medium,
  },
})

export default BetaNote
