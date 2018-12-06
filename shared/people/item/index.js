// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'
import {isMobile} from '../../constants/platform'
import {formatTimeForPeopleItem} from '../../util/timestamp'

export type Props = {
  badged: boolean,
  icon: React.Node,
  children: React.Node,
  when?: Date,
  contentStyle?: any,
}

export default (props: Props) => (
  <Kb.Box
    style={{
      ...containerStyle,
      backgroundColor: props.badged ? globalColors.blue4 : globalColors.white,
      borderBottomColor: props.badged ? globalColors.white : globalColors.black_10,
    }}
  >
    <Kb.Box style={iconContainerStyle}>{props.icon}</Kb.Box>
    <Kb.Box2
      direction="vertical"
      gap="tiny"
      style={{
        ...childrenContainerStyle,
        ...props.contentStyle,
      }}
    >
      {props.children}
    </Kb.Box2>
    <Kb.Box style={timestampContainerStyle}>
      {!!props.when && <Kb.Text type="BodySmall">{formatTimeForPeopleItem(props.when.getTime())}</Kb.Text>}
      {props.badged && <Kb.Box style={badgeStyle} />}
    </Kb.Box>
  </Kb.Box>
)

const containerStyle = {
  ...globalStyles.flexBoxRow,
  borderBottomWidth: 1,
  paddingBottom: globalMargins.tiny,
  paddingLeft: 12,
  paddingTop: globalMargins.tiny,
  position: 'relative',
  ...(isMobile ? null : {borderStyle: 'solid'}),
}

const iconContainerStyle = {marginRight: 20, width: isMobile ? 48 : 32}

const childrenContainerStyle = {
  overflow: 'hidden',
  paddingRight: isMobile ? 100 : 80,
  position: 'relative',
  width: 'auto',
}

const timestampContainerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  position: 'absolute',
  right: 8,
  top: 12,
}

const badgeStyle = {
  backgroundColor: globalColors.orange,
  borderRadius: 6,
  height: 8,
  marginLeft: globalMargins.xtiny,
  marginTop: isMobile ? 3 : 1,
  width: 8,
}
