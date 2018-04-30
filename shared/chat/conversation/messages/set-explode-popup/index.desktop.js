// @flow
import * as React from 'react'
import {type MessageExplodeDescription} from '../../../../constants/types/chat2'
import {Box2, Icon, Text, FloatingMenu} from '../../../../common-adapters'
import {platformStyles, globalColors, globalMargins} from '../../../../styles'
import type {Props} from '.'

type HeaderProps = {
  isNew: boolean,
}

const Header = (props: HeaderProps) => (
  <Box2 gap="xtiny" direction="vertical" style={headerContainerStyle}>
    {props.isNew && (
      <Box2 direction="vertical" style={announcementContainerStyle}>
        <Icon
          type="iconfont-boom"
          color={globalColors.white}
          fontSize={48}
          style={platformStyles({isElectron: {display: 'block', lineHeight: '28px', maxHeight: 28}})}
        />
        <Text type="BodySemibold" backgroundMode="Announcements" style={{textAlign: 'center'}}>
          Set a timeout on your messages and watch them
        </Text>
        <Text type="BodySemibold" backgroundMode="Announcements">
          E X P L O D E
        </Text>
      </Box2>
    )}
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

export default (props: Props) => {
  const selected = props.selected || {text: 'Never', seconds: 0}
  const listItems = props.items.map(it => ({
    onClick: () => props.onSelect(it),
    title: it.text,
    view: <Item desc={it} selected={selected.seconds === it.seconds} onSelect={props.onSelect} />,
  }))
  listItems.unshift({
    title: 'Explode message after:',
    view: <Text type="BodySmallSemibold">Explode messages after:</Text>,
    disabled: true,
  })
  return (
    <FloatingMenu
      attachTo={props.attachTo}
      visible={props.visible}
      header={{title: 'announcement-header', view: <Header isNew={props.isNew} />}}
      closeOnSelect={true}
      onHidden={props.onHidden}
      items={listItems}
    />
  )
}
