import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'

const useAutocompleter = <T extends React.Component<any>, U>(
  items: Array<{label: string; value: U}>,
  onSelect: (value: U) => void,
  filter: string
) => {
  const [selected, setSelected] = React.useState(0)
  const filterLCase = filter.trim().toLowerCase()
  const prevFilterLCase = Container.usePrevious(filterLCase)
  React.useEffect(() => {
    if (prevFilterLCase !== filterLCase) {
      setSelected(0)
    }
  }, [setSelected, prevFilterLCase, filterLCase])
  let itemsFiltered = filter ? items.filter(item => item.label.toLowerCase().includes(filterLCase)) : items
  itemsFiltered = itemsFiltered.slice(0, 5)

  const {popup, popupAnchor, setShowingPopup, showingPopup} = Kb.usePopup<T>(
    getAttachmentRef => (
      <Kb.Overlay
        attachTo={getAttachmentRef}
        visible={showingPopup}
        onHidden={() => setShowingPopup(false)}
        matchDimension={true}
        position="top center"
        positionFallbacks={['bottom center']}
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
              style={Styles.collapseStyles([styles.option, selected === idx && styles.optionSelected])}
            >
              <Kb.Text type="BodySemibold" lineClamp={1}>
                {item.label}
              </Kb.Text>
            </Kb.Box2>
          </Kb.ClickableBox>
        ))}
      </Kb.Overlay>
    ),
    [filterLCase, selected]
  )

  const numItems = itemsFiltered.length
  const selectedItem = itemsFiltered[selected]
  const onKeyDown = React.useCallback(
    evt => {
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
          onSelect(selectedItem.value)
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

  return {onKeyDown, popup, popupAnchor, setShowingPopup}
}

const styles = Styles.styleSheetCreate(() => ({
  option: {...Styles.padding(4, 10, 2), backgroundColor: Styles.globalColors.white},
  optionOuter: {backgroundColor: Styles.globalColors.white}, // because blueLighter2 is transparent in dark mode
  optionSelected: {
    backgroundColor: Styles.globalColors.blueLighter2,
  },
}))

export default useAutocompleter
