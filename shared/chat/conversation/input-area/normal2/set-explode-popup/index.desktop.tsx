import * as Kb from '@/common-adapters'
import type {Props} from '.'
import useHooks from './hooks'
import type {MessageExplodeDescription} from './hooks'

const quantityTextStyle = Kb.Styles.platformStyles({
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
        <Kb.Text3 type="Body" style={quantityTextStyle}>
          {words[0]}
        </Kb.Text3>
        {' ' + words.slice(1).join(' ')}
      </>
    )
  }
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.Text3 type="Body" style={{flex: 1}}>
        {content}
      </Kb.Text3>
      {props.selected && <Kb.Icon type="iconfont-check" color={Kb.Styles.globalColors.blue} />}
    </Kb.Box2>
  )
}

const SetExplodePopup = (p: Props) => {
  const props = useHooks(p)
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
    view: <Kb.Text3 type="BodySmallSemibold">Explode messages after:</Kb.Text3>,
  })
  return (
    <Kb.FloatingMenu
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
