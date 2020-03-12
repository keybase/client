import * as React from 'react'
import {Box, Text, Button, StandardScreen} from '../../../common-adapters/mobile.native'
import * as Styles from '../../../styles'
import {Props} from './you-rekey'

const YouRekey = ({onEnterPaperkey, onBack}: Props) => {
  const notification = {message: 'This conversation needs to be rekeyed.', type: 'error' as const}

  return (
    <StandardScreen onBack={onBack} theme="dark" notification={notification}>
      <Box style={styles.container}>
        <Box
          style={{
            ...Styles.globalStyles.flexBoxColumn,
            alignItems: 'stretch',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <Text center={true} type="BodySmall" style={styles.text} negative={true}>
            To unlock this conversation, open one of your other devices or enter a paperkey.
          </Text>
          <Button onClick={onEnterPaperkey} label="Enter a paper key" />
        </Box>
      </Box>
    </StandardScreen>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'stretch',
        flex: 1,
        justifyContent: 'flex-start',
      },
      text: {
        marginBottom: Styles.globalMargins.large,
        marginTop: Styles.globalMargins.large,
      },
    } as const)
)

export default YouRekey
