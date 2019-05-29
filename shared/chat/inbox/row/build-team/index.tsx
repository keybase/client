import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  onBuildTeam: () => void
  showBuildATeam: boolean
}

const DividerBox = Styles.styled(Kb.Box)({
  ...Styles.globalStyles.flexBoxRow,
  ...(Styles.isMobile
    ? {backgroundColor: Styles.globalColors.fastBlank}
    : {
        ':hover': {
          borderBottomColor: Styles.globalColors.greyLight,
          borderTopColor: Styles.globalColors.greyLight,
        },
      }),
  alignItems: 'center',
  borderStyle: 'solid',
  borderTopColor: Styles.globalColors.black_10,
  borderTopWidth: 1,
  height: '100%',
  justifyContent: 'flex-start',
  paddingLeft: Styles.globalMargins.tiny,
  paddingRight: Styles.globalMargins.tiny,
  position: 'relative',
  width: '100%',
})

const BuildTeam = ({showBuildATeam, onBuildTeam}: Props) =>
  showBuildATeam ? (
    <Kb.ClickableBox title="Make a new team" onClick={onBuildTeam} style={styles.container}>
      <DividerBox>
        <Kb.Box style={styles.text}>
          <Kb.Text type="BodySmallSemibold">Build a team!</Kb.Text>
        </Kb.Box>
      </DividerBox>
    </Kb.ClickableBox>
  ) : null

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fillAbsolute,
      backgroundColor: Styles.globalColors.blueGrey,
      flexShrink: 0,
      height: 32,
      top: undefined,
    },
    isMobile: {
      backgroundColor: Styles.globalColors.fastBlank,
      flexShrink: 0,
      height: 48,
    },
  }),
  text: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    minHeight: 24,
  },
})

export default BuildTeam
