// @flow
import * as Types from '../../constants/types/search'
import * as React from 'react'
import {Box, Icon, ClickableBox, Text} from '../../common-adapters/index'
import {
  globalColors,
  globalStyles,
  globalMargins,
  hairlineWidth,
  isMobile,
  platformStyles,
} from '../../styles'
import IconOrAvatar from '../icon-or-avatar'
import {followingStateToStyle} from '../shared'

const Left = ({leftService, leftIcon, leftUsername, leftFollowingState, leftFullname}) => {
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
        />
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
        <Text type="BodySemibold" style={followingStateToStyle(leftFollowingState)}>
          {leftUsername}
        </Text>
        {!!leftFullname && <Text type="BodySmall">{leftFullname}</Text>}
      </Box>
    </Box>
  )
}

const Middle = ({rightService, rightIcon, rightUsername, rightFollowingState}) => {
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

const Right = ({showTrackerButton, onShowTracker}) => {
  return showTrackerButton ? (
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
        marginRight: isMobile ? globalMargins.xtiny : globalMargins.small,
      }}
      color={globalColors.blue}
    />
  ) : null
}

const Line = () => (
  <Box
    style={{
      ...globalStyles.fillAbsolute,
      backgroundColor: globalColors.black_05,
      left: 56,
      top: undefined,
      maxHeight: hairlineWidth,
      minHeight: hairlineWidth,
    }}
  />
)

const SearchResultRow = (props: Types.RowProps) => (
  <ClickableBox
    style={_clickableBoxStyle[(!!props.selected).toString()]}
    underlayColor={globalColors.blue4}
    onClick={!props.userIsInTeam ? props.onClick : null}
    onMouseOver={props.onMouseOver}
  >
    <Box style={_rowStyle}>
      <Left
        leftFollowingState={props.leftFollowingState}
        leftIcon={props.leftIcon}
        leftService={props.leftService}
        leftUsername={props.leftUsername}
        leftFullname={props.leftFullname}
      />
      <Middle
        rightFollowingState={props.rightFollowingState}
        rightIcon={props.rightIcon}
        rightService={props.rightService}
        rightUsername={props.rightUsername}
      />
      <Right showTrackerButton={props.showTrackerButton} onShowTracker={props.onShowTracker} />
      <RightEdge showCheckmark={props.userIsInTeam} />
      <Line />
    </Box>
  </ClickableBox>
)

const _clickableBoxStyleCommon = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  width: '100%',
  ...(isMobile
    ? {
        minHeight: 56,
        maxHeight: 56,
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
    backgroundColor: globalColors.blue4,
  },
}

const _rowStyle = {
  ..._clickableBoxStyleCommon,
  alignItems: 'center',
  justifyContent: 'flex-start',
  position: 'relative',
}

export default SearchResultRow
