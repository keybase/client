import * as React from 'react'
import * as Styles from '@/styles'
import Text, {type TextType} from '@/common-adapters/text'

export const SpoilerContext = React.createContext<boolean>(false)

type Props = {
  children: React.ReactNode
  context?: string
  content: string
  type?: 'service' | 'preview'
}

const spoilerState = new Map<string, boolean>()

const Spoiler = (p: Props) => {
  const {children, content, context, type} = p
  const isPreview = type === 'preview'
  // const isServiceOnly = type === 'service'
  const key = `${context ?? ''}:${content}`
  const [shown, setShown] = React.useState(spoilerState.get(key))

  const lastKey = React.useRef(key)
  if (lastKey.current !== key) {
    lastKey.current = key
    setShown(false)
  }

  const onClick = React.useCallback(() => {
    setShown(s => {
      spoilerState.set(key, !s)
      return !s
    })
  }, [key])

  const showMasked = isPreview && Styles.isMobile
  const len = content.length
  const masked = React.useMemo(() => {
    return showMasked ? Array(len).fill('•').join('') : ''
  }, [showMasked, len])

  return (
    <SpoilerContext.Provider value={!shown}>
      {showMasked ? (
        <Text type="BodySmall">{masked}</Text>
      ) : (
        <Text
          className={shown ? undefined : 'spoiler'}
          type="BodySmall"
          onClick={onClick}
          style={shown ? styles.shown : styles.hidden}
          title={shown ? '' : 'Click to reveal'}
        >
          {children || content}
        </Text>
      )}
    </SpoilerContext.Provider>
  )
}

export const InnerSpoiled = (p: {children: React.ReactNode; type: TextType; style?: any}) => {
  return (
    <Text className={'spoiler'} type="BodySmall" style={Styles.collapseStyles([p.style, styles.hidden])}>
      {p.children}
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
