// @flow
import * as React from 'react'
import {messageExplodeDescriptions} from '../../../../constants/chat2'
import {type MessageExplodeDescription} from '../../../../constants/types/chat2'
import {Box, Icon, Text, FloatingMenu} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../../styles'

const sortedDescriptions = messageExplodeDescriptions.sort((a, b) => (a.seconds < b.seconds ? 1 : 0))

type HeaderProps = {
  isNew: boolean,
}

const Header = (props: HeaderProps) => (
  <Box style={headerContainerStyle}>
    {props.isNew && (
      <Box style={announcementContainerStyle}>
        <Text type="BodySemibold" backgroundMode="Announcements" style={{textAlign: 'center'}}>
          Set a timeout on your messages and watch them
        </Text>
        <Text type="BodySemibold" backgroundMode="Announcements">
          E X P L O D E
        </Text>
      </Box>
    )}
    <Box style={headerTextContainerStyle}>
      <Text type="BodySmallSemibold">Explode message after:</Text>
    </Box>
  </Box>
)

const headerContainerStyle = {
  ...globalStyles.flexBoxColumn,
  width: 200,
}

const announcementContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  padding: globalMargins.small,
  paddingBottom: globalMargins.tiny,
}

const headerTextContainerStyle = {
  paddingLeft: 16,
  paddingTop: 5,
}

type ItemProps = {
  desc: MessageExplodeDescription,
  selected: boolean,
  onSelect: MessageExplodeDescription => void,
}

const Item = (props: ItemProps) => (
  <Box style={globalStyles.flexBoxRow}>
    <Text type="Body" style={{flex: 1}}>
      {props.desc.text}
    </Text>
    {props.selected && <Icon type="iconfont-check" color={globalColors.blue} />}
  </Box>
)

type Props = {
  attachTo: ?React.Component<*, *>,
  visible: boolean,
  onHidden: () => void,
  isNew: boolean,
  selected: ?MessageExplodeDescription,
  onSelect: MessageExplodeDescription => void,
}

export default (props: Props) => {
  const selected = props.selected || {text: 'Never', seconds: 0}
  const items = sortedDescriptions.map(it => ({
    onClick: () => props.onSelect(it),
    title: it.text,
    view: <Item desc={it} selected={selected.seconds === it.seconds} onSelect={props.onSelect} />,
  }))
  return (
    <FloatingMenu
      attachTo={props.attachTo}
      visible={props.visible}
      header={{title: 'announcement-header', view: <Header isNew={props.isNew} />}}
      closeOnSelect={true}
      onHidden={props.onHidden}
      items={items}
    />
  )
}
