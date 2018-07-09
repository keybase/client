// @flow
import * as React from 'react'
import {ClickableBox, Box, Text} from '../../../common-adapters'
import {
  platformStyles,
  globalStyles,
  globalColors,
  globalMargins,
  glamorous,
  styleSheetCreate,
  isMobile,
} from '../../../styles'

type Props = {
  onBuildTeam: () => void,
}

const DividerBox = glamorous(Box)({
  ...globalStyles.flexBoxRow,
  ...(isMobile
    ? {backgroundColor: globalColors.fastBlank}
    : {
        ':hover': {
          borderBottomColor: globalColors.lightGrey,
          borderTopColor: globalColors.lightGrey,
        },
      }),
  alignItems: 'center',
  borderStyle: 'solid',
  borderTopColor: globalColors.black_05,
  borderTopWidth: 1,
  height: '100%',
  justifyContent: 'flex-start',
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  position: 'relative',
  width: '100%',
})

const BuildTeam = ({showBuildATeam, onBuildTeam}: Props) => (
  <ClickableBox title="Make a new team" onClick={onBuildTeam} style={styles.container}>
    <DividerBox>
      <Box style={styles.text}>
        <Text type="BodySmallSemibold">Build a team!</Text>
      </Box>
    </DividerBox>
  </ClickableBox>
)

const styles = styleSheetCreate({
  container: platformStyles({
    isElectron: {
      ...globalStyles.fillAbsolute,
      backgroundColor: globalColors.blue5,
      flexShrink: 0,
      height: 32,
      top: undefined,
    },
    isMobile: {
      backgroundColor: globalColors.fastBlank,
      flexShrink: 0,
      height: 48,
    },
  }),
  text: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    minHeight: 24,
  },
})

export default BuildTeam
