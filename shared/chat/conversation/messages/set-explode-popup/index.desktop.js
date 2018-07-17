// @flow
import * as React from 'react'
import {type MessageExplodeDescription} from '../../../../constants/types/chat2'
import {Box2, Icon, Text, FloatingMenu} from '../../../../common-adapters'
import {platformStyles, globalColors, globalMargins} from '../../../../styles'
import type {Props} from './index.types'

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
        <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{textAlign: 'center'}}>
          Set a timeout on your messages and watch them
          E&nbsp;&nbsp;&nbsp;X&nbsp;&nbsp;&nbsp;P&nbsp;&nbsp;&nbsp;L&nbsp;&nbsp;&nbsp;O&nbsp;&nbsp;&nbsp;D&nbsp;&nbsp;&nbsp;E.
        </Text>
        <Text
          type="BodySmallSemiboldInlineLink"
          backgroundMode="Announcements"
          className="underline"
          onClickURL="https://keybase.io/blog/keybase-exploding-messages"
        >
          Learn more
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

const quantityTextStyle = platformStyles({
  common: {
    textAlign: 'right',
    // NOTE if times are added that have three digits, this will need to be increased.
    width: 15,
  },
  isElectron: {
    display: 'inline-block',
  },
})

type ItemProps = {
  desc: MessageExplodeDescription,
  selected: boolean,
}

const Item = (props: ItemProps) => {
  let content
  const words = props.desc.text.split(' ')
  if (props.desc.seconds === 0) {
    // never item
    content = props.desc.text
  } else {
    content = (
      <React.Fragment>
        <Text type="Body" style={quantityTextStyle}>
          {words[0]}
        </Text>
        {' ' + words.slice(1).join(' ')}
      </React.Fragment>
    )
  }
  return (
    <Box2 direction="horizontal" fullWidth={true}>
      <Text type="Body" style={{flex: 1}}>
        {content}
      </Text>
      {props.selected && <Icon type="iconfont-check" color={globalColors.blue} />}
    </Box2>
  )
}

const SetExplodePopup = (props: Props) => {
  const selected = props.selected || {text: 'Never', seconds: 0}
  const listItems = props.items.map(it => ({
    onClick: () => props.onSelect(it.seconds),
    title: it.text,
    view: <Item desc={it} selected={selected === it.seconds} />,
  }))
  listItems.unshift({
    title: 'Explode message after:',
    view: <Text type="BodySmallSemibold">Explode messages after:</Text>,
    disabled: true,
  })
  return (
    <FloatingMenu
      attachTo={props.attachTo}
      position="top center"
      visible={props.visible}
      header={{title: 'announcement-header', view: <Header isNew={props.isNew} />}}
      closeOnSelect={true}
      onHidden={props.onHidden}
      items={listItems}
    />
  )
}

export default SetExplodePopup
