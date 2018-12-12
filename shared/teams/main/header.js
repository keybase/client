// @flow
import * as React from 'react'
import {
  ClickableBox,
  Box2,
  HeaderHocHeader,
  Icon,
  ProgressIndicator,
  Text,
  type IconType,
} from '../../common-adapters'
import {
  globalColors,
  globalMargins,
  globalStyles,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../../styles'

export type HeaderButtonProps = {
  iconType: IconType,
  label: string,
  onClick: () => void,
}

const HeaderButton = (props: HeaderButtonProps) => (
  <ClickableBox onClick={props.onClick} style={styles.button}>
    {!isMobile && <Icon type={props.iconType} color={globalColors.blue} fontSize={isMobile ? 20 : 16} />}
    <Text type="BodyBigLink" style={styles.text}>
      {props.label}
    </Text>
  </ClickableBox>
)

export type Props = {
  loaded: boolean,
  onCreateTeam: () => void,
  onJoinTeam: () => void,
}

const Header = (props: Props) => (
  <>
    <HeaderHocHeader title="Teams" />
    <Box2
      gap="small"
      direction="horizontal"
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        borderBottomColor: globalColors.black_10,
        borderBottomWidth: 1,
        height: 48,
        justifyContent: isMobile ? 'space-between' : 'center',
        position: 'relative',
        width: '100%',
      }}
    >
      {/* Put progress indicator in the footer (./index.js) on mobile because it won't fit in the header on small screens */}
      {!isMobile &&
        !props.loaded && <ProgressIndicator style={{left: 12, position: 'absolute', top: 12, width: 20}} />}
      <HeaderButton iconType="iconfont-new" label="Create a team" onClick={props.onCreateTeam} />
      <HeaderButton iconType="iconfont-team-join" label="Join a team" onClick={props.onJoinTeam} />
    </Box2>
  </>
)

const styles = styleSheetCreate({
  button: platformStyles({
    common: {
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
    },
    isElectron: {
      marginLeft: globalMargins.medium,
      marginRight: globalMargins.medium,
    },
    isMobile: {
      marginLeft: globalMargins.tiny,
      marginRight: globalMargins.tiny,
    },
  }),
  text: {
    margin: globalMargins.tiny,
  },
})

export default Header
