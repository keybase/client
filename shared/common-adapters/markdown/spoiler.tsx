import * as React from 'react'
import * as Styles from '@/styles'
import Text from '@/common-adapters/text'
import {registerExternalResetter} from '@/util/zustand'

type Props = {
  children: React.ReactNode
  context?: string
  content: string
}

const spoilerState = new Map<string, boolean>()

// module scope outlives sign-out; keyed by message content, and a spoiler the
// previous user revealed must not come up already revealed for the next one
registerExternalResetter('markdown-spoiler-state', () => {
  spoilerState.clear()
})

const Spoiler = (p: Props) => {
  const styles = useStyles()
  const {children, content, context} = p
  const key = `${context ?? ''}:${content}`
  const [shown, setShown] = React.useState(spoilerState.get(key))
  const lastKey = React.useRef(key)

  React.useEffect(() => {
    if (lastKey.current !== key) {
      lastKey.current = key
      setShown(false)
    }
  }, [key])

  const onClick = (e: React.BaseSyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShown(s => {
      spoilerState.set(key, !s)
      return !s
    })
  }

  const smallContent = content.substring(0, 10)
  const len = smallContent.length
  const masked = Array(len).fill('•').join('')

  return (
    <Text
      className={shown ? undefined : 'spoiler'}
      type="BodySmall"
      onClick={onClick}
      style={shown ? styles.shown : styles.hidden}
      title={shown ? '' : 'Click to reveal'}
    >
      {shown ? children || content : masked}
    </Text>
  )
}

const useStyles = Styles.createStyleHook(theme => ({
  hidden: Styles.platformStyles({
    common: {
      backgroundColor: theme.black_on_white,
      color: theme.black_on_white,
    },
    isElectron: {
      borderRadius: Styles.borderRadius,
      ...Styles.paddingH(2),
    },
  }),
  shown: Styles.platformStyles({
    common: {
      backgroundColor: theme.black_on_white,
      color: theme.white,
    },
    isElectron: {
      borderRadius: Styles.borderRadius,
      ...Styles.paddingH(2),
    },
  }),
} as const))

export default Spoiler
