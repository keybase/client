import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import Icon2 from './icon2'
import ProgressIndicator from './progress-indicator'
import Text from './text'

const Kb = {
  Box2,
  Icon2,
  ProgressIndicator,
  Text,
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
    let id: ReturnType<typeof setTimeout> | undefined
    if (lastSavingRef.current !== saving) {
      if (saving) {
        setState('saving')
      } else {
        setState('saved')
        id = setTimeout(() => {
          setState('init')
        }, 1000)
      }

      lastSavingRef.current = saving
    }

    return () => {
      if (id !== undefined) clearTimeout(id)
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
          <Kb.Icon2 type="iconfont-check" color={Styles.globalColors.green} />
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
