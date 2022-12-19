import * as React from 'react'
import type {MessageExplodeDescription} from '../../../../constants/types/chat2'
import {Box2, Icon, Text, FloatingMenu, type MenuItems} from '../../../../common-adapters'
import {platformStyles, globalColors} from '../../../../styles'
import type {Props} from '.'

const quantityTextStyle = platformStyles({
  common: {
    textAlign: 'right',
    // NOTE if times are added that have three digits, this will need to be increased.
    width: 15,
  },
  isElectron: {display: 'inline-block'},
})

type ItemProps = {
  desc: MessageExplodeDescription
  selected: boolean
}

const Item = (props: ItemProps) => {
  let content: React.ReactNode
  const words = props.desc.text.split(' ')
  if (props.desc.seconds === 0) {
    // never item
    content = props.desc.text
  } else {
    content = (
      <>
        <Text type="Body" style={quantityTextStyle}>
          {words[0]}
        </Text>
        {' ' + words.slice(1).join(' ')}
      </>
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
  const listItems: MenuItems = props.items.map(it => ({
    disabled: false,
    onClick: () => props.onSelect(it.seconds),
    title: it.text,
    view: <Item desc={it} selected={props.selected === it.seconds} />,
  }))
  listItems.unshift({
    disabled: true,
    onClick: undefined,
    title: 'Explode message after:',
    view: <Text type="BodySmallSemibold">Explode messages after:</Text>,
  })
  return (
    <FloatingMenu
      attachTo={props.attachTo}
      position="top left"
      visible={props.visible}
      closeOnSelect={true}
      onHidden={props.onHidden}
      items={listItems}
      containerStyle={{
        bottom: 3,
        position: 'relative',
      }}
    />
  )
}

export default SetExplodePopup
