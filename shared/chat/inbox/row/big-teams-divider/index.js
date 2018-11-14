// @flow
import * as React from 'react'
import {ClickableBox, Icon, Box, Badge} from '../../../../common-adapters'
import {
  platformStyles,
  globalStyles,
  globalColors,
  globalMargins,
  glamorous,
  styleSheetCreate,
  isMobile,
} from '../../../../styles'
import {BigTeamsLabel} from '../big-teams-label'

type Props = {
  badgeCount: number,
  toggle: () => void,
}

const DividerBox = glamorous(Box)({
  ...globalStyles.flexBoxRow,
  ...(isMobile
    ? {backgroundColor: globalColors.fastBlank}
    : {
        ':hover': {
          color: globalColors.black_40,
        },
        color: globalColors.black_20,
      }),
  alignItems: 'center',
  borderStyle: 'solid',
  borderTopColor: globalColors.black_10,
  borderTopWidth: 1,
  height: '100%',
  justifyContent: 'flex-start',
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  position: 'relative',
  width: '100%',
})

const BigTeamsDivider = ({toggle, badgeCount}: Props) => (
  <ClickableBox title="Teams with multiple channels." onClick={toggle} style={styles.container}>
    <DividerBox>
      <BigTeamsLabel isFiltered={false} />
      {badgeCount > 0 && <Badge badgeStyle={styles.badge} badgeNumber={badgeCount} />}
      <Box style={styles.icon}>
        <Icon type="iconfont-arrow-up" inheritColor={true} fontSize={isMobile ? 20 : 16} />
      </Box>
    </DividerBox>
  </ClickableBox>
)

const styles = styleSheetCreate({
  badge: {
    marginLeft: globalMargins.xtiny,
    marginRight: 0,
    position: 'relative',
  },
  container: platformStyles({
    isElectron: {
      ...globalStyles.fillAbsolute,
      backgroundColor: globalColors.blue5,
      flexShrink: 0,
      height: 40,
      top: undefined,
    },
    isMobile: {
      backgroundColor: globalColors.fastBlank,
      flexShrink: 0,
      height: 48,
    },
  }),
  icon: {
    ...globalStyles.fillAbsolute,
    ...globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: isMobile ? globalMargins.tiny : globalMargins.xtiny,
  },
})

export {BigTeamsDivider, BigTeamsLabel}
