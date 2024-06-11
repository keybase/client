import * as T from '@/constants/types'
import * as React from 'react'
import * as C from '@/constants'
import * as Styles from '@/styles'
import Channel from '../channel-container'
import KbfsPath from '@/fs/common/kbfs-path'
import MaybeMention from './maybe-mention'
import Mention from '../mention-container'
import PaymentStatus from '../../chat/payments/status/container'
import Text, {type StylesTextCrossPlatform} from '@/common-adapters/text'
import WithTooltip from '../with-tooltip'
import type {StyleOverride} from '.'
import type {
  emojiDataToRenderableEmoji as emojiDataToRenderableEmojiType,
  renderEmoji as renderEmojiType,
  RPCToEmojiData as RPCToEmojiDataType,
} from '@/util/emoji'
import {base64ToUint8Array, uint8ArrayToString} from 'uint8array-extras'

const prefix = 'keybase://'
const linkIsKeybaseLink = (link: string) => link.startsWith(prefix)

const linkStyle = Styles.platformStyles({
  isElectron: {fontWeight: 'inherit'},
  isMobile: {fontWeight: undefined},
})

type KeybaseLinkProps = {
  link: string
  linkStyle?: StylesTextCrossPlatform | undefined
  wrapStyle?: StylesTextCrossPlatform | undefined
}

const KeybaseLink = (props: KeybaseLinkProps) => {
  const handleAppLink = C.useDeepLinksState(s => s.dispatch.handleAppLink)
  const onClick = React.useCallback(() => {
    handleAppLink(props.link)
  }, [handleAppLink, props.link])

  return (
    <Text
      className="hover-underline hover_contained_color_blueDark"
      type="BodyPrimaryLink"
      style={Styles.collapseStyles([props.wrapStyle, linkStyle, props.linkStyle])}
      title={props.link}
      onClick={onClick}
    >
      {props.link}
    </Text>
  )
}

type WarningLinkProps = {
  display: string
  url: string
  punycode: string
  linkStyle?: StylesTextCrossPlatform | undefined
  wrapStyle?: StylesTextCrossPlatform | undefined
}

const WarningLink = (props: WarningLinkProps) => {
  const {display, punycode, url} = props
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  if (Styles.isMobile) {
    return (
      <Text
        className="hover-underline"
        type="BodyPrimaryLink"
        style={Styles.collapseStyles([props.wrapStyle, linkStyle, props.linkStyle])}
        title={display}
        onClick={() =>
          navigateAppend({props: {display, punycode, url}, selected: 'chatConfirmNavigateExternal'})
        }
      >
        {display}
      </Text>
    )
  }
  return (
    <Text
      className="hover-underline"
      type="BodyPrimaryLink"
      style={Styles.collapseStyles([props.wrapStyle, linkStyle, props.linkStyle])}
      title={display}
      onClickURL={url}
      onLongPressURL={url}
    >
      <WithTooltip
        tooltip={punycode}
        containerStyle={Styles.platformStyles({
          isElectron: {display: 'inline-block'},
        })}
      >
        {display}
      </WithTooltip>
    </Text>
  )
}

export type Props = {
  json: string
  allowFontScaling?: boolean
  styleOverride?: StyleOverride
  styles: {[K in string]: StylesTextCrossPlatform}
  disableBigEmojis: boolean
  disableEmojiAnimation: boolean
  messageType?: T.Chat.MessageType
}

const ServiceDecoration = (p: Props) => {
  const {json, allowFontScaling, styles, styleOverride} = p
  const {disableBigEmojis, disableEmojiAnimation, messageType} = p
  // Parse JSON to get the type of the decoration
  let parsed: T.RPCChat.UITextDecoration
  try {
    const jsonString = uint8ArrayToString(base64ToUint8Array(json))
    parsed = JSON.parse(jsonString) as T.RPCChat.UITextDecoration
  } catch {
    return null
  }
  if (parsed.typ === T.RPCChat.UITextDecorationTyp.payment && messageType === 'text') {
    let paymentID: T.Wallets.PaymentID | undefined
    let error: string | undefined
    if (
      parsed.payment.result.resultTyp === T.RPCChat.TextPaymentResultTyp.sent &&
      parsed.payment.result.sent
    ) {
      paymentID = parsed.payment.result.sent
    } else if (
      parsed.payment.result.resultTyp === T.RPCChat.TextPaymentResultTyp.error &&
      parsed.payment.result.error
    ) {
      error = parsed.payment.result.error
    } else {
      error = 'unknown text decoration'
    }
    return (
      <PaymentStatus
        paymentID={paymentID}
        error={error}
        text={parsed.payment.paymentText}
        allowFontScaling={allowFontScaling}
      />
    )
  } else if (parsed.typ === T.RPCChat.UITextDecorationTyp.atmention && parsed.atmention) {
    return (
      <Mention
        allowFontScaling={allowFontScaling || false}
        style={styles['wrapStyle']}
        username={parsed.atmention}
      />
    )
  } else if (parsed.typ === T.RPCChat.UITextDecorationTyp.maybemention) {
    return (
      <MaybeMention
        allowFontScaling={allowFontScaling || false}
        style={styles['wrapStyle']}
        name={parsed.maybemention.name}
        channel={parsed.maybemention.channel}
      />
    )
  } else if (parsed.typ === T.RPCChat.UITextDecorationTyp.link) {
    const link = parsed.link.url
    const openUrl =
      link.toLowerCase().startsWith('http://') || link.toLowerCase().startsWith('https://')
        ? link
        : 'http://' + link
    return linkIsKeybaseLink(link) ? (
      <KeybaseLink link={link} linkStyle={styleOverride?.link} wrapStyle={styles['wrapStyle']} />
    ) : parsed.link.punycode ? (
      <WarningLink
        url={openUrl}
        display={parsed.link.url}
        punycode={parsed.link.punycode}
        linkStyle={styleOverride?.link}
        wrapStyle={styles['wrapStyle']}
      />
    ) : (
      <Text
        className="hover-underline hover_contained_color_blueDark"
        type="BodyPrimaryLink"
        style={Styles.collapseStyles([styles['wrapStyle'], linkStyle, styleOverride?.link])}
        title={parsed.link.url}
        onClickURL={openUrl}
        onLongPressURL={openUrl}
      >
        {parsed.link.url}
      </Text>
    )
  } else if (parsed.typ === T.RPCChat.UITextDecorationTyp.mailto) {
    const openUrl = parsed.mailto.url.toLowerCase().startsWith('mailto:')
      ? parsed.mailto.url
      : 'mailto:' + parsed.mailto.url
    return (
      <Text
        className="hover-underline hover_contained_color_blueDark"
        type="BodyPrimaryLink"
        style={Styles.collapseStyles([styles['wrapStyle'], linkStyle, styleOverride?.mailto])}
        title={parsed.mailto.url}
        onClickURL={openUrl}
        onLongPressURL={openUrl}
      >
        {parsed.mailto.url}
      </Text>
    )
  } else if (parsed.typ === T.RPCChat.UITextDecorationTyp.channelnamemention) {
    return (
      <Channel
        allowFontScaling={allowFontScaling || false}
        convID={parsed.channelnamemention.convID}
        name={parsed.channelnamemention.name}
        style={
          Styles.collapseStyles([
            styles['linkStyle'],
            linkStyle,
            styleOverride?.link,
          ]) as StylesTextCrossPlatform
        }
      />
    )
  } else if (parsed.typ === T.RPCChat.UITextDecorationTyp.kbfspath) {
    return (
      <KbfsPath
        knownPathInfo={{
          deeplinkPath: parsed.kbfspath.pathInfo.deeplinkPath,
          platformAfterMountPath: parsed.kbfspath.pathInfo.platformAfterMountPath,
        }}
        rawPath={parsed.kbfspath.rawPath}
        standardPath={parsed.kbfspath.standardPath}
      />
    )
  } else if (parsed.typ === T.RPCChat.UITextDecorationTyp.emoji) {
    const {emojiDataToRenderableEmoji, renderEmoji, RPCToEmojiData} = require('@/util/emoji') as {
      emojiDataToRenderableEmoji: typeof emojiDataToRenderableEmojiType
      renderEmoji: typeof renderEmojiType
      RPCToEmojiData: typeof RPCToEmojiDataType
    }
    return renderEmoji({
      customStyle: styleOverride?.customEmoji,
      emoji: emojiDataToRenderableEmoji(RPCToEmojiData(parsed.emoji, disableEmojiAnimation)),
      showTooltip: !parsed.emoji.isReacji,
      size:
        parsed.emoji.isBig && !disableBigEmojis ? 32 : parsed.emoji.isReacji && !Styles.isMobile ? 18 : 16,
      style: styleOverride?.emoji,
    })
  }
  return null
}

export default ServiceDecoration
