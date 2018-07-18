// @flow
import * as React from 'react'
import {Box2} from '../../../common-adapters'
import {styleSheetCreate} from '../../../styles'
import Header from '../header'

type Props = {
  displayChoices: Array<{currencyCode: string, symbol: string}>,
  otherChoices: Array<{code: string, disabledExplanation: string, issuer: string}>,
}

const ChooseAsset = (props: Props) => (
  <Box2 direction="vertical" style={styles.container}>
    <Header whiteBackground={true} />
    <Box2 direction="horizontal" fullWidth={true} style={styles.header} />
  </Box2>
)

const styles = styleSheetCreate({
  container: {
    width: 360,
  },
  header: {},
})

export default ChooseAsset
