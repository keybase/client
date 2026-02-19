import * as React from 'react'
import {Box2} from './box'
import ScrollView from './scroll-view'
import {Text3} from './text3'
import Icon from './icon'
import logger from '@/logger'
import * as Styles from '@/styles'

type AllErrorInfo = {
  name: string
  message: string
  stack: string
  componentStack: string
}

type FallbackProps = {
  closeOnClick?: () => void
  info: AllErrorInfo
  style?: Styles.StylesCrossPlatform
}

const detailContainerStyle = {
  maxHeight: 100,
  minWidth: '75%',
  padding: 10,
} as const

const Fallback = ({closeOnClick, info: {name, message, stack, componentStack}, style}: FallbackProps) => {
  return (
    <Box2 direction="vertical" style={Styles.collapseStyles([styles.container, style])}>
      <ScrollView style={styles.scroll}>
        <Box2 direction="vertical" gap="small" fullWidth={true}>
          <Text3 type="Header">Something went wrong...</Text3>
          <Text3 type="Body">
            Please submit a bug report by
            {Styles.isMobile ? ' going into Settings / Feedback' : ' running this command in your terminal:'}
          </Text3>
          {!Styles.isMobile && (
            <Box2
              direction="vertical"
              style={{
                backgroundColor: Styles.globalColors.blueDarker2,
                borderRadius: 4,
                minWidth: 100,
                padding: 10,
              }}
            >
              <Text3 type="Terminal" negative={true} selectable={true}>
                keybase log send
              </Text3>
            </Box2>
          )}
          <Text3 type="BodySmall">Error details</Text3>
          <Text3 type="BodySmall" selectable={true} style={{margin: 10}}>{`${name}: ${message}`}</Text3>
          <Text3 type="BodySmall" style={{marginTop: 20}}>
            Stack trace
          </Text3>
          <ScrollView style={detailContainerStyle}>
            <Text3 type="BodySmall" selectable={true} style={styles.detailStyle}>
              {stack}
            </Text3>
          </ScrollView>
          <Text3 type="BodySmall">Component stack trace</Text3>
          <ScrollView style={detailContainerStyle}>
            <Text3 type="BodySmall" selectable={true} style={styles.detailStyle}>
              {componentStack}
            </Text3>
          </ScrollView>
        </Box2>
        {closeOnClick && (
          <Icon
            type="iconfont-close"
            style={{position: 'absolute', right: Styles.globalMargins.tiny, top: Styles.globalMargins.tiny}}
            onClick={closeOnClick}
          />
        )}
      </ScrollView>
    </Box2>
  )
}

type Props = {
  children: React.ReactNode
  closeOnClick?: () => void
  fallbackStyle?: Styles.StylesCrossPlatform
}

import {ErrorBoundary} from 'react-error-boundary'

const EB = (p: Props) => {
  const {children, fallbackStyle, closeOnClick} = p
  const [componentStack, setComponentStack] = React.useState('')

  const onError = React.useCallback((_error: Error, info: React.ErrorInfo) => {
    setComponentStack(info.componentStack ?? '')
  }, [])

  const fallbackRender = React.useCallback(
    (fp: {error: Error; resetErrorBoundary: (...args: unknown[]) => void}) => {
      const allInfo: AllErrorInfo = {
        componentStack,
        message: fp.error.message,
        name: fp.error.name,
        stack: fp.error.stack || '',
      }
      logger.error('Got boundary error:', allInfo)
      return <Fallback info={allInfo} closeOnClick={closeOnClick} style={fallbackStyle} />
    },
    [componentStack, fallbackStyle, closeOnClick]
  )

  return (
    <ErrorBoundary fallbackRender={fallbackRender} onError={onError}>
      {children}
    </ErrorBoundary>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        height: '100%',
        padding: Styles.globalMargins.medium,
        position: 'relative',
        width: '100%',
      },
      detailStyle: Styles.platformStyles({isElectron: {whiteSpace: 'pre'}}),
      scroll: {bottom: 24, left: 24, position: 'absolute', right: 24, top: 24},
    }) as const
)

export default EB
