// @flow
import * as React from 'react'
import {Box2, ClickableBox, Emoji, Text} from '../../../../common-adapters'
import {glamorous, globalColors, globalMargins, styleSheetCreate, transition} from '../../../../styles'

type Props = {
  count: number,
  emoji: string,
  onClick: () => void,
}

const ButtonBox = glamorous(ClickableBox)({
  ':hover': {
    backgroundColor: globalColors.blue4,
    borderColor: globalColors.blue,
  },
  borderColor: globalColors.black_05,
})

const ReactButton = (props: Props) => (
  <ButtonBox onClick={props.onClick} style={styles.buttonBox}>
    <Box2 centerChildren={true} direction="horizontal" gap="xtiny" style={styles.container}>
      <Emoji size={14} emojiName={props.emoji} />
      <Text type="BodySmall">{props.count}</Text>
    </Box2>
  </ButtonBox>
)

const styles = styleSheetCreate({
  buttonBox: {
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: '2px',
    ...transition('border-color', 'background-color'),
  },
  container: {
    height: 24,
    paddingBottom: globalMargins.tiny,
    paddingLeft: globalMargins.xtiny,
    paddingRight: globalMargins.xtiny,
    paddingTop: globalMargins.tiny,
  },
})

export default ReactButton
