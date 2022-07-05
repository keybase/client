import * as React from 'react'
import Box from './box'
import ScrollView from './scroll-view'
import Text from './text'
import Icon from './icon'
import logger from '../logger'
import * as Styles from '../styles'

// Although not mentioned in
// https://reactjs.org/blog/2017/07/26/error-handling-in-react-16.html ,
// the info parameter to componentDidCatch looks like this.
type ErrorInfo = {
  componentStack: string
}

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

const detailHeaderStyle = {
  marginBottom: 10,
  marginTop: 20,
}

const detailContainerStyle = {
  maxHeight: 100,
  minWidth: '75%',
  padding: 10,
}

const detailStyle = Styles.platformStyles({
  isElectron: {
    whiteSpace: 'pre',
  },
})

const Fallback = ({closeOnClick, info: {name, message, stack, componentStack}, style}: FallbackProps) => {
  return (
    <ScrollView
      style={Styles.collapseStyles([
        {
          height: '100%',
          padding: Styles.globalMargins.medium,
          position: 'relative',
          width: '100%',
        },
        style,
      ])}
    >
      <Box
        style={{
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <Text type="Header">Something went wrong...</Text>
        <Text type="Body" style={{marginBottom: 10, marginTop: 10}}>
          Please submit a bug report by
          {Styles.isMobile ? ' going into Settings / Feedback' : ' running this command in your terminal:'}
        </Text>
        {!Styles.isMobile && (
          <Box
            style={{
              ...Styles.globalStyles.flexBoxColumn,
              backgroundColor: Styles.globalColors.blueDarker2,
              borderRadius: 4,
              minWidth: 100,
              padding: 10,
            }}
          >
            <Text type="Terminal" negative={true} selectable={true}>
              keybase log send
            </Text>
          </Box>
        )}
        <Text type="BodySmall" style={detailHeaderStyle}>
          Error details
        </Text>
        <Text type="BodySmall" selectable={true} style={{margin: 10}}>{`${name}: ${message}`}</Text>
        <Text type="BodySmall" style={{marginTop: 20}}>
          Stack trace
        </Text>
        <ScrollView style={detailContainerStyle}>
          <Text type="BodySmall" selectable={true} style={detailStyle}>
            {stack}
          </Text>
        </ScrollView>

        <Text type="BodySmall" style={detailHeaderStyle}>
          Component stack trace
        </Text>
        <ScrollView style={detailContainerStyle}>
          <Text type="BodySmall" selectable={true} style={detailStyle}>
            {componentStack}
          </Text>
        </ScrollView>
      </Box>
      {closeOnClick && (
        <Icon
          type="iconfont-close"
          style={{position: 'absolute', right: Styles.globalMargins.tiny, top: Styles.globalMargins.tiny}}
          onClick={closeOnClick}
        />
      )}
    </ScrollView>
  )
}

type Props = {
  children: React.ReactNode
  closeOnClick?: () => void
  fallbackStyle?: Styles.StylesCrossPlatform
}

type State = {
  info: AllErrorInfo | null
}

class ErrorBoundary extends React.PureComponent<Props, State> {
  state = {info: null}

  componentDidUpdate(prevProps: Props) {
    if (this.props.children !== prevProps.children && this.state.info) {
      this.setState(p => (p.info ? {info: null} : null))
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const allInfo: AllErrorInfo = {
      componentStack: info.componentStack,
      message: error.message,
      name: error.name,
      stack: error.stack || '',
    }
    logger.error('Got boundary error:', allInfo)
    this.setState({info: allInfo})
  }

  render() {
    const info = this.state.info
    if (info) {
      return <Fallback info={info} closeOnClick={this.props.closeOnClick} style={this.props.fallbackStyle} />
    }
    return this.props.children
  }
}

export default ErrorBoundary

export {Fallback}
