import * as React from 'react'
import * as Styles from '@/styles'
import Text from '@/common-adapters/text'

type Props = {
  children: React.ReactNode
  context?: string
  content: string
}

const spoilerState = new Map<string, boolean>()

const Spoiler = (p: Props) => {
  const {children, content, context} = p
  const key = `${context ?? ''}:${content}`
  const [shown, setShown] = React.useState(spoilerState.get(key))

  const lastKey = React.useRef(key)
  if (lastKey.current !== key) {
    lastKey.current = key
    setShown(false)
  }

  const onClick = React.useCallback(
    (e: React.BaseSyntheticEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setShown(s => {
        spoilerState.set(key, !s)
        return !s
      })
    },
    [key]
  )

  const smallContent = content.substring(0, 10)
  const len = smallContent.length
  const masked = React.useMemo(() => {
    return Array(len).fill('•').join('')
  }, [len])

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

const styles = Styles.styleSheetCreate(() => {
  return {
    hidden: Styles.platformStyles({
      common: {
        backgroundColor: Styles.globalColors.black_on_white,
        color: Styles.globalColors.black_on_white,
      },
      isElectron: {
        borderRadius: Styles.borderRadius,
        paddingLeft: 2,
        paddingRight: 2,
      },
    }),
    shown: Styles.platformStyles({
      common: {
        backgroundColor: Styles.globalColors.black_on_white,
        color: Styles.globalColors.white,
      },
      isElectron: {
        borderRadius: Styles.borderRadius,
        paddingLeft: 2,
        paddingRight: 2,
      },
    }),
    tip: Styles.platformStyles({
      isElectron: {
        alignItems: 'flex-start',
        display: 'inline-flex',
      },
    }),
  } as const
})

export default Spoiler
