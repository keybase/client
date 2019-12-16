import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RowSizes from '../sizes'
import {BigTeamsLabel} from '../big-teams-label'

type Props = {
  badgeCount: number
  toggle: () => void
}

const DividerBox = Styles.styled(Kb.Box)(() => ({
  ...(Styles.isMobile
    ? {backgroundColor: Styles.globalColors.fastBlank}
    : {
        ':hover': {
          color: Styles.globalColors.black_50,
        },
        color: Styles.globalColors.black_20,
      }),
}))

const BigTeamsDivider = ({toggle, badgeCount}: Props) => (
  <Kb.ClickableBox title="Teams with multiple channels." onClick={toggle} style={styles.container}>
    <DividerBox style={styles.dividerBox}>
      <BigTeamsLabel />
      {badgeCount > 0 && <Kb.Badge badgeStyle={styles.badge} badgeNumber={badgeCount} />}
      <Kb.Box style={styles.icon}>
        <Kb.Icon type="iconfont-arrow-up" inheritColor={true} fontSize={Styles.isMobile ? 20 : 16} />
      </Kb.Box>
    </DividerBox>
  </Kb.ClickableBox>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        marginLeft: Styles.globalMargins.xtiny,
        marginRight: 0,
        position: 'relative',
      },
      container: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.fillAbsolute,
          backgroundColor: Styles.globalColors.blueLighter3,
          flexShrink: 0,
          height: RowSizes.floatingDivider,
          top: undefined,
        },
        isMobile: {
          backgroundColor: Styles.globalColors.fastBlank,
          flexShrink: 0,
          height: RowSizes.floatingDivider,
        },
      }),
      dividerBox: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          borderStyle: 'solid',
          borderTopColor: Styles.globalColors.black_10,
          borderTopWidth: 1,
          height: '100%',
          justifyContent: 'flex-start',
          position: 'relative',
          width: '100%',
        },
        isElectron: {
          paddingLeft: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
        },
      }),
      icon: {
        ...Styles.globalStyles.fillAbsolute,
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'flex-start',
        justifyContent: 'center',
        marginTop: Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.xtiny,
      },
    } as const)
)

export {BigTeamsDivider, BigTeamsLabel}
