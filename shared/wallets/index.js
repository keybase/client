// @flow
import * as React from 'react'
import {Box2, Text, Button} from '../common-adapters'
import {styleSheetCreate} from '../styles'

type Props = {
  hello: string,
  refresh: () => void,
}

const Todo = ({hello, refresh}: Props) => (
  <Box2 direction="vertical" fullHeight={true} gap="xlarge" gapStart={true} gapEnd={true}>
    <Text type="Body" style={styles.text}>
      Wallets hello: {hello}
    </Text>
    <Button type="Primary" label="Click" onClick={refresh} />
  </Box2>
)

const styles = styleSheetCreate({
  text: {
    textAlign: 'center',
  },
})

export default Todo
