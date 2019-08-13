import * as Types from '../../constants/types/search'
import * as React from 'react'
import * as Kb from '../../common-adapters/index'
import * as Styles from '../../styles'
import IconOrAvatar from '../icon-or-avatar'
import {followingStateToStyle} from '../shared'

const Left = ({leftService, leftIcon, leftIconOpaque, leftUsername, leftFollowingState, leftFullname}) => {
  return (
    <Kb.Box style={styles.container}>
      <Kb.Box style={styles.leftBox}>
        <IconOrAvatar
          service={leftService}
          username={leftUsername}
          icon={leftIcon}
          avatarSize={Styles.isMobile ? 48 : 32}
          opacity={leftIconOpaque ? 1 : 0.3}
        />
      </Kb.Box>
      <Kb.Box style={styles.rightBox}>
        <Kb.Text
          type="BodySemibold"
          style={Styles.collapseStyles([followingStateToStyle(leftFollowingState), {letterSpacing: 0.2}])}
        >
          {leftUsername}
        </Kb.Text>
        {!!leftFullname && <Kb.Text type="BodySmall">{leftFullname}</Kb.Text>}
      </Kb.Box>
    </Kb.Box>
  )
}

const Middle = ({rightService, rightIcon, rightIconOpaque, rightUsername, rightFollowingState}) => {
  return (
    <Kb.Box
      style={{
        ...Styles.globalStyles.flexBoxColumn,
        height: '100%',
        justifyContent: 'center',
        width: Styles.isMobile ? 100 : 120,
      }}
    >
      <Kb.Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'flex-start'}}>
        <IconOrAvatar
          service={rightService}
          username={rightUsername}
          icon={rightIcon}
          opacity={rightIconOpaque ? 1 : 0.3}
          fontSize={16}
          avatarSize={16}
          style={styles.avatar}
        />
        {!!rightUsername && (
          <Kb.Text
            type="BodySmallSemibold"
            style={Styles.collapseStyles([styles.rightUsername, followingStateToStyle(rightFollowingState)])}
          >
            {rightUsername}
          </Kb.Text>
        )}
      </Kb.Box>
    </Kb.Box>
  )
}

const Right = ({onShowTracker}) => {
  return onShowTracker ? (
    <Kb.Icon
      type="iconfont-usercard"
      onClick={onShowTracker}
      style={styles.icon}
      fontSize={Styles.isMobile ? 22 : 16}
    />
  ) : null
}

const RightEdge = ({showCheckmark}) => {
  return showCheckmark ? (
    <Kb.Icon type="iconfont-check" style={styles.icon} color={Styles.globalColors.blue} />
  ) : null
}

export type Props = Types.RowProps

const SearchResultRow = (props: Props) => (
  <Kb.ClickableBox
    style={!!props.selected && props.leftIconOpaque ? styles.boxSelected : styles.boxNotSelected}
    underlayColor={Styles.globalColors.blueLighter2}
    onClick={props.userIsSelectable ? props.onClick : undefined}
    onMouseOver={props.onMouseOver}
  >
    <Kb.Box style={styles.row}>
      <Left
        leftFollowingState={props.leftFollowingState}
        leftIcon={props.leftIcon}
        leftIconOpaque={props.leftIconOpaque}
        leftService={props.leftService}
        leftUsername={props.leftUsername}
        leftFullname={props.leftFullname}
      />
      <Middle
        rightFollowingState={props.rightFollowingState}
        rightIcon={props.rightIcon}
        rightIconOpaque={props.rightIconOpaque}
        rightService={props.rightService}
        rightUsername={props.rightUsername}
      />
      <Right onShowTracker={props.onShowTracker} />
      <RightEdge showCheckmark={props.userAlreadySelected} />
      <Kb.Divider style={styles.divider} />
    </Kb.Box>
  </Kb.ClickableBox>
)

const boxStyle = {
  ...Styles.globalStyles.flexBoxRow,
  flex: 1,
  width: '100%',
  ...(Styles.isMobile
    ? {
        maxHeight: 56,
        minHeight: 56,
      }
    : {
        maxHeight: 48,
        minHeight: 48,
      }),
}

const styles = Styles.styleSheetCreate(() => ({
  avatar: {
    ...Styles.globalStyles.flexBoxColumn,
    height: 16,
    marginRight: Styles.globalMargins.xtiny,
    marginTop: Styles.isMobile ? 1 : 0,
    width: 16,
  },
  boxNotSelected: {
    ...boxStyle,
  },
  boxSelected: {
    ...boxStyle,
    backgroundColor: Styles.globalColors.blueLighter2,
  },
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flex: 1,
    height: '100%',
    paddingLeft: Styles.globalMargins.tiny,
  },
  divider: {
    ...Styles.globalStyles.fillAbsolute,
    left: Styles.isMobile ? 68 : 56,
    maxHeight: Styles.hairlineWidth,
    minHeight: Styles.hairlineWidth,
    top: undefined,
  },
  icon: {
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
  },
  leftBox: {
    ...Styles.globalStyles.flexBoxCenter,
    width: Styles.isMobile ? 48 : 32,
  },
  rightBox: {
    ...Styles.globalStyles.flexBoxColumn,
    marginLeft: Styles.globalMargins.small,
  },
  rightUsername: Styles.platformStyles({
    common: {
      flex: 1,
      overflow: 'hidden',
    },
    isElectron: {
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
    },
  }),
  row: {
    ...boxStyle,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
}))

export default SearchResultRow
