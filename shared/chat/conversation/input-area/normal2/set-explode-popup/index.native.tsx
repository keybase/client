import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from '.'

const Prompt = () => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={promptContainerStyle}>
    <Kb.Text type="BodySmallSemibold">Explode messages after:</Kb.Text>
  </Kb.Box2>
)

const promptContainerStyle = {
  alignItems: 'center',
  justifyContent: 'center',
} as const

const SetExplodePopup = (props: Props) => {
  const items = props.items.map(item => ({
    onClick: () => {
      props.onSelect(item.seconds)
      props.onHidden()
    },
    title: item.text,
    value: item.seconds,
  }))

  return (
    <Kb.FloatingModalContext.Provider value="bottomsheet">
      <Kb.FloatingMenu
        header={<Prompt />}
        closeOnSelect={true}
        items={items}
        onHidden={props.onHidden}
        visible={props.visible}
      />
    </Kb.FloatingModalContext.Provider>
  )
}

export default SetExplodePopup
