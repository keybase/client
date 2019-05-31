import * as Types from '../../constants/types/search'
import * as React from 'react'
import {Box, Icon, ClickableBox, Divider, Text} from '../../common-adapters/index'
import {
  collapseStyles,
  globalColors,
  globalStyles,
  globalMargins,
  hairlineWidth,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../../styles'
import IconOrAvatar from '../icon-or-avatar'
import {followingStateToStyle} from '../shared'

const Left = ({leftService, leftIcon, leftIconOpaque, leftUsername, leftFollowingState, leftFullname}) => {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        flex: 1,
        height: '100%',
        paddingLeft: globalMargins.tiny,
      }}
    >
      <Box style={{...globalStyles.flexBoxCenter, width: isMobile ? 48 : 32}}>
        <IconOrAvatar
          service={leftService}
          username={leftUsername}
          icon={leftIcon}
          avatarSize={isMobile ? 48 : 32}
          opacity={leftIconOpaque ? 1 : 0.3}
        />
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
        <Text
          type="BodySemibold"
          style={collapseStyles([followingStateToStyle(leftFollowingState), {letterSpacing: 0.2}])}
        >
          {leftUsername}
        </Text>
        {!!leftFullname && <Text type="BodySmall">{leftFullname}</Text>}
      </Box>
    </Box>
  )
}

const Middle = ({rightService, rightIcon, rightIconOpaque, rightUsername, rightFollowingState}) => {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        height: '100%',
        justifyContent: 'center',
        width: isMobile ? 100 : 120,
      }}
    >
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-start'}}>
        <IconOrAvatar
          service={rightService}
          username={rightUsername}
          icon={rightIcon}
          opacity={rightIconOpaque ? 1 : 0.3}
          fontSize={16}
          avatarSize={16}
          style={{
            ...globalStyles.flexBoxColumn,
            height: 16,
            marginRight: globalMargins.xtiny,
            marginTop: isMobile ? 1 : 0,
            width: 16,
          }}
        />
        {!!rightUsername && (
          <Text
            type="BodySmallSemibold"
            style={platformStyles({
              common: {
                ...followingStateToStyle(rightFollowingState),
                flex: 1,
                overflow: 'hidden',
              },
              isElectron: {
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
              },
            })}
          >
            {rightUsername}
          </Text>
        )}
      </Box>
    </Box>
  )
}

const Right = ({onShowTracker}) => {
  return onShowTracker ? (
    <Icon
      type="iconfont-usercard"
      onClick={onShowTracker}
      style={{
        marginLeft: globalMargins.small,
        marginRight: globalMargins.small,
      }}
      fontSize={isMobile ? 22 : 16}
    />
  ) : null
}

const RightEdge = ({showCheckmark}) => {
  return showCheckmark ? (
    <Icon
      type="iconfont-check"
      style={{
        marginLeft: globalMargins.small,
        marginRight: globalMargins.small,
      }}
      color={globalColors.blue}
    />
  ) : null
}

export type Props = Types.RowProps

const SearchResultRow = (props: Props) => (
  <ClickableBox
    style={_clickableBoxStyle[(!!props.selected && props.leftIconOpaque).toString()]}
    underlayColor={globalColors.blueLighter2}
    onClick={props.userIsSelectable ? props.onClick : null}
    onMouseOver={props.onMouseOver}
  >
    <Box style={_rowStyle}>
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
      <Divider style={styles.divider} />
    </Box>
  </ClickableBox>
)

const _clickableBoxStyleCommon = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  width: '100%',
  ...(isMobile
    ? {
        maxHeight: 56,
        minHeight: 56,
      }
    : {
        maxHeight: 48,
        minHeight: 48,
      }),
}

const _clickableBoxStyle = {
  false: _clickableBoxStyleCommon,
  true: {
    ..._clickableBoxStyleCommon,
    backgroundColor: globalColors.blueLighter2,
  },
}

const _rowStyle = {
  ..._clickableBoxStyleCommon,
  alignItems: 'center',
  justifyContent: 'flex-start',
  position: 'relative',
}

const styles = styleSheetCreate({
  divider: {
    ...globalStyles.fillAbsolute,
    left: isMobile ? 68 : 56,
    maxHeight: hairlineWidth,
    minHeight: hairlineWidth,
    top: undefined,
  },
})

export default SearchResultRow
