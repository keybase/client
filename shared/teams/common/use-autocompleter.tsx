import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'

const positionFallbacks = ['bottom center'] as const

function useAutocompleter<U>(
  items: Array<{label: string; value: U}>,
  onSelect: (value: U) => void,
  filter: string
) {
  const [selected, setSelected] = React.useState(0)
  const filterLCase = filter.trim().toLowerCase()
  const prevFilterLCase = Container.usePrevious(filterLCase)
  React.useEffect(() => {
    if (prevFilterLCase !== filterLCase) {
      setSelected(0)
    }
  }, [setSelected, prevFilterLCase, filterLCase])
  const itemsFiltered = React.useMemo(() => {
    let itemsFiltered = filterLCase
      ? items.filter(item => item.label.toLowerCase().includes(filterLCase))
      : items
    itemsFiltered = itemsFiltered.slice(0, 5)
    return itemsFiltered
  }, [items, filterLCase])

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <Kb.Overlay
          attachTo={attachTo}
          onHidden={hidePopup}
          matchDimension={true}
          position="top center"
          positionFallbacks={positionFallbacks}
        >
          {itemsFiltered.map((item, idx) => (
            <Kb.ClickableBox
              key={item.label}
              onMouseDown={() => onSelect(item.value)}
              onMouseOver={() => setSelected(idx)}
              style={styles.optionOuter}
            >
              <Kb.Box2
                direction="horizontal"
                fullWidth={true}
                style={Kb.Styles.collapseStyles([styles.option, selected === idx && styles.optionSelected])}
              >
                <Kb.Text type="BodySemibold" lineClamp={1}>
                  {item.label}
                </Kb.Text>
              </Kb.Box2>
            </Kb.ClickableBox>
          ))}
        </Kb.Overlay>
      )
    },
    [onSelect, selected, itemsFiltered]
  )

  const {popup, popupAnchor, showPopup, hidePopup} = Kb.usePopup2(makePopup)

  const numItems = itemsFiltered.length
  const selectedItem = itemsFiltered[selected]
  const onKeyDown = React.useCallback(
    (evt: {key: string}) => {
      let diff = 0
      switch (evt.key) {
        case 'ArrowDown':
          diff = 1
          break
        case 'ArrowUp':
          diff = -1
          break
        case 'Enter':
          setSelected(0)
          selectedItem?.value && onSelect(selectedItem.value)
          return
      }
      let newSelected = selected + diff
      if (newSelected >= numItems) {
        newSelected = 0
      } else if (newSelected < 0) {
        newSelected = numItems - 1
      }
      if (newSelected !== selected) {
        setSelected(newSelected)
      }
    },
    [selected, setSelected, numItems, onSelect, selectedItem]
  )

  return {hidePopup, onKeyDown, popup, popupAnchor, showPopup}
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  option: {...Kb.Styles.padding(4, 10, 2), backgroundColor: Kb.Styles.globalColors.white},
  optionOuter: {backgroundColor: Kb.Styles.globalColors.white}, // because blueLighter2 is transparent in dark mode
  optionSelected: {
    backgroundColor: Kb.Styles.globalColors.blueLighter2,
  },
}))

export default useAutocompleter
