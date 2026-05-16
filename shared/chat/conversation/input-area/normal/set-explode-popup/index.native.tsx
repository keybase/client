import * as Kb from '@/common-adapters'
import type {Props} from '@/chat/conversation/input-area/normal/set-explode-popup/index.shared'
import useHooks from '@/chat/conversation/input-area/normal/set-explode-popup/hooks'

const Prompt = () => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={promptContainerStyle} justifyContent="center">
    <Kb.Text type="BodySmallSemibold">Explode messages after:</Kb.Text>
  </Kb.Box2>
)

const promptContainerStyle = {
  alignItems: 'center',
} as const

const SetExplodePopup = (p: Props) => {
  const props = useHooks(p)
  const items = props.items.map(item => ({
    onClick: () => {
      props.onSelect(item.seconds)
    },
    title: item.text,
    value: item.seconds,
  }))

  return (
    <Kb.FloatingMenu
      header={<Prompt />}
      closeOnSelect={true}
      items={items}
      mode="bottomsheet"
      onHidden={props.onHidden}
      visible={props.visible}
    />
  )
}

export default SetExplodePopup
