import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import Icon from './icon'
import ProgressIndicator from './progress-indicator'
import {Text3} from './text3'

const Kb = {
  Box2,
  Icon,
  ProgressIndicator,
  Text3,
}

type SaveState = 'init' | 'saving' | 'saved'

export type Props = {
  saving: boolean
  style?: Styles.StylesCrossPlatform
}

const defaultStyle = {
  height: Styles.globalMargins.medium,
} as const

const SaveIndicator = (props: Props) => {
  const {saving, style} = props
  const [state, setState] = React.useState<SaveState>('init')
  const lastSavingRef = React.useRef(saving)

  React.useEffect(() => {
    let id = 0
    if (lastSavingRef.current !== saving) {
      if (saving) {
        setState('saving')
      } else {
        setState('saved')
        id = setTimeout(() => {
          setState('init')
        }, 1000) as unknown as number
      }

      lastSavingRef.current = saving
    }

    return () => {
      clearTimeout(id)
    }
  }, [saving])

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
          <Kb.Text3 type="BodySmall" style={{color: Styles.globalColors.greenDark}}>
            &nbsp; Saved
          </Kb.Text3>
        </>
      )
      break
  }

  return <Kb.Box2 direction="horizontal" centerChildren={true} style={Styles.collapseStyles([defaultStyle, style])}>{content}</Kb.Box2>
}

export default SaveIndicator
