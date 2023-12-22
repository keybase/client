import * as React from 'react'
import * as Styles from '@/styles'
import Text from '@/common-adapters/text'

type Props = {
  context?: string
  content: string
}

const spoilerState = new Map<string, boolean>()

const Spoiler = (p: Props) => {
  const {content, context} = p
  const key = `${context ?? ''}:${content}`
  const [shown, setShown] = React.useState(spoilerState.get(key))

  const onClick = React.useCallback(() => {
    spoilerState.set(key, true)
    setShown(true)
  }, [key])

  return (
    <Text
      type="BodySmall"
      onClick={onClick}
      style={shown ? styles.shown : styles.hidden}
      title={shown ? '' : 'Click to reveal'}
    >
      {content}
    </Text>
  )
}

export const styles = Styles.styleSheetCreate(() => {
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
