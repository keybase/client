import React from 'react'
import * as Kb from '../common-adapters'
import * as Container from '../util/container'
import * as Styles from '../styles'
import openURL from '../util/open-url'

type PunycodeLinkWarningProps = Container.RouteProps<{
  display: string
  punycode: string
  url: string
}>

const PunycodeLinkWarning = (props: PunycodeLinkWarningProps) => {
  const url = Container.getRouteProps(props, 'url', '')
  const display = Container.getRouteProps(props, 'display', '')
  const punycode = Container.getRouteProps(props, 'punycode', '')
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onCancel = () => dispatch(nav.safeNavigateUpPayload())
  const onConfirm = () => {
    openURL(url)

    dispatch(nav.safeNavigateUpPayload())
  }
  const description = `The link you clicked on appears to be ${display}, but actually points to ${punycode}.`
  return (
    <Kb.ConfirmModal
      icon="iconfont-open-browser"
      iconColor={Styles.globalColors.red}
      prompt={'Open URL?'}
      description={description}
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmText="Yes, open in browser"
    />
  )
}

export default PunycodeLinkWarning
