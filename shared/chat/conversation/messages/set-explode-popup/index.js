// @flow
import * as React from 'react'
import {messageExplodeDescriptions} from '../../../../constants/chat2'
import {type MessageExplodeDescription} from '../../../../constants/types/chat2'
import {Box2, Icon, Text, FloatingMenu} from '../../../../common-adapters'
import {collapseStyles, globalColors, globalMargins} from '../../../../styles'

const sortedDescriptions = messageExplodeDescriptions.sort((a, b) => (a.seconds < b.seconds ? 1 : 0))

type HeaderProps = {
  isNew: boolean,
}

const Header = (props: HeaderProps) => (
  <Box2 direction="vertical" style={headerContainerStyle}>
    {props.isNew && (
      <Box2 direction="vertical" style={announcementContainerStyle}>
        <Box2 direction="vertical" style={{marginTop: -10, marginBottom: -10}}>
          <Icon type="iconfont-boom" color={globalColors.white} fontSize={48} />
        </Box2>
        <Text type="BodySemibold" backgroundMode="Announcements" style={{textAlign: 'center'}}>
          Set a timeout on your messages and watch them
        </Text>
        <Text type="BodySemibold" backgroundMode="Announcements">
          E X P L O D E
        </Text>
      </Box2>
    )}
    <Box2
      direction="horizontal"
      gap="small"
      fullWidth={true}
      gapStart={true}
      style={collapseStyles([{paddingTop: 5, alignItems: 'center'}, props.isNew ? null : {paddingTop: 10}])}
    >
      <Text type="BodySmallSemibold">Explode message after:</Text>
    </Box2>
  </Box2>
)

const headerContainerStyle = {
  width: 200,
}

const announcementContainerStyle = {
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  padding: globalMargins.small,
  paddingBottom: globalMargins.tiny,
}

type ItemProps = {
  desc: MessageExplodeDescription,
  selected: boolean,
  onSelect: MessageExplodeDescription => void,
}

const Item = (props: ItemProps) => (
  <Box2 direction="horizontal" fullWidth={true}>
    <Text type="Body" style={{flex: 1}}>
      {props.desc.text}
    </Text>
    {props.selected && <Icon type="iconfont-check" color={globalColors.blue} />}
  </Box2>
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
