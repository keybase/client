import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import Icon from './icon'
import ProgressIndicator from './progress-indicator'
import Text from './text'

const Kb = {
  Box2,
  Icon,
  ProgressIndicator,
  Text,
}

type SaveState = 'init' | 'saving' | 'saved'

type IndicatorState = {
  saving: boolean
  state: SaveState
}

export type Props = {
  saving: boolean
  style?: Styles.StylesCrossPlatform
}

const defaultStyle = {
  height: Styles.globalMargins.medium,
} as const

const SaveIndicator = (props: Props) => {
  const {saving, style} = props
  const [indicatorState, setIndicatorState] = React.useState<IndicatorState>(() => ({
    saving,
    state: 'init',
  }))

  let currentIndicatorState = indicatorState
  if (currentIndicatorState.saving !== saving) {
    currentIndicatorState = {
      saving,
      state: saving ? 'saving' : 'saved',
    }
    setIndicatorState(currentIndicatorState)
  }
  const {state} = currentIndicatorState

  React.useEffect(() => {
    if (state !== 'saved') {
      return undefined
    }

    const id = setTimeout(() => {
      setIndicatorState(state => (state.state === 'saved' ? {...state, state: 'init'} : state))
    }, 1000)
    return () => {
      clearTimeout(id)
    }
  }, [state])

  let content: React.ReactNode = null
  switch (state) {
    case 'init':
      content = null
      break
    case 'saving':
      content = <Kb.ProgressIndicator style={{width: Styles.globalMargins.medium}} />
      break
    case 'saved':
      content = (
        <>
          <Kb.Icon type="iconfont-check" color={Styles.globalColors.green} />
          <Kb.Text type="BodySmall" style={{color: Styles.globalColors.greenDark}}>
            &nbsp; Saved
          </Kb.Text>
        </>
      )
      break
  }

  return <Kb.Box2 direction="horizontal" centerChildren={true} style={Styles.collapseStyles([defaultStyle, style])}>{content}</Kb.Box2>
}

export default SaveIndicator
