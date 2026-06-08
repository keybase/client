import * as Kb from '@/common-adapters'
import type {Props} from './index.shared'
import useHooks from './hooks'
import type {MessageExplodeDescription} from './hooks'

const quantityTextStyle = Kb.Styles.platformStyles({
  common: {
    textAlign: 'right',
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
    content = props.desc.text
  } else {
    content = (
      <>
        <Kb.Text type="Body" style={quantityTextStyle}>
          {words[0]}
        </Kb.Text>
        {' ' + words.slice(1).join(' ')}
      </>
    )
  }
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.Text type="Body" style={{flex: 1}}>
        {content}
      </Kb.Text>
      {props.selected && <Kb.Icon type="iconfont-check" color={Kb.Styles.globalColors.blue} />}
    </Kb.Box2>
  )
}

const PromptNative = () => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    gap="xtiny"
    centerChildren={true}
  >
    <Kb.Text type="BodySmallSemibold">Explode messages after:</Kb.Text>
  </Kb.Box2>
)

const SetExplodePopup = (p: Props) => {
  const props = useHooks(p)

  if (!isMobile) {
    const listItems: Kb.MenuItems = props.items.map(it => ({
      disabled: false,
      onClick: () => props.onSelect(it.seconds),
      title: it.text,
      view: <Item desc={it} selected={props.selected === it.seconds} />,
    }))
    listItems.unshift({
      disabled: true,
      onClick: undefined,
      title: 'Explode message after:',
      view: <Kb.Text type="BodySmallSemibold">Explode messages after:</Kb.Text>,
    })
    return (
      <Kb.FloatingMenu
        attachTo={props.attachTo}
        position="top left"
        visible={props.visible}
        closeOnSelect={true}
        onHidden={props.onHidden}
        items={listItems}
        containerStyle={{bottom: 3, position: 'relative'}}
      />
    )
  }

  const items = props.items.map(item => ({
    onClick: () => {
      props.onSelect(item.seconds)
    },
    title: item.text,
    value: item.seconds,
  }))

  return (
    <Kb.FloatingMenu
      header={<PromptNative />}
      closeOnSelect={true}
      items={items}
      mode="bottomsheet"
      onHidden={props.onHidden}
      visible={props.visible}
    />
  )
}

export default SetExplodePopup
