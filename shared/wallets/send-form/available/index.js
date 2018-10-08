// @flow
import * as React from 'react'
import * as Styles from '../../../styles'
import {Box2, Text} from '../../../common-adapters'

type Props = {|
  amountErrMsg: string,
|}

const Available = (props: Props) => (
  <Box2 direction="vertical">
    {!!props.amountErrMsg && (
      <Text type="Body" style={styles.text}>
        {props.amountErrMsg}
      </Text>
    )}
  </Box2>
)

const styles = Styles.styleSheetCreate({
  text: {
    color: Styles.globalColors.red,
    textAlign: 'center',
  },
})

export default Available
