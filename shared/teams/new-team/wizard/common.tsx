import * as Kb from '@/common-adapters'
import * as React from 'react'

// blue illustration banner across the top of a wizard step
export const WizardBanner = (props: {icon: Kb.IconType}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
    <Kb.ImageIcon type={props.icon} />
  </Kb.Box2>
)

// the + button under a repeatable input list (create channels / subteams)
export const AddRowButton = (props: {onAdd: () => void}) => (
  <Kb.IconButton mode="Secondary" icon="iconfont-new" onClick={props.onAdd} style={styles.addButton} />
)

// editable list of strings backing the repeatable inputs
export const useStringList = (initial: ReadonlyArray<string>) => {
  const [items, setItems] = React.useState([...initial])
  return {
    addItem: () => setItems(prev => [...prev, '']),
    clearItem: (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i)),
    items,
    setItem: (i: number, value: string) => setItems(prev => prev.map((s, idx) => (idx === i ? value : s))),
  }
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  addButton: Kb.Styles.platformStyles({
    isElectron: {width: 42},
    isMobile: {width: 47},
    isTablet: {alignSelf: 'flex-start'},
  }),
  banner: Kb.Styles.platformStyles({
    common: {backgroundColor: Kb.Styles.globalColors.blue, height: 96},
    isElectron: {overflowX: 'hidden'},
  }),
}))

export const wizardInputStyle = {...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall)}
