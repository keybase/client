import * as Container from '../../util/container'
import * as DeeplinksConstants from '../../constants/deeplinks'
import * as DeeplinksGen from '../../actions/deeplinks-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import * as WalletTypes from '../../constants/types/wallets'
import Channel from '../channel-container'
import KbfsPath from '../../fs/common/kbfs-path'
import MaybeMention from '../../chat/conversation/maybe-mention'
import Mention from '../mention-container'
import PaymentStatus from '../../chat/payments/status/container'
import Text, {type StylesTextCrossPlatform} from '../text'
import WithTooltip from '../with-tooltip'
import type * as Types from '../../constants/types/chat2'
import type {StyleOverride} from '.'
import {emojiDataToRenderableEmoji, renderEmoji, RPCToEmojiData} from '../../util/emoji'
import {toByteArray} from 'base64-js'

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
  const dispatch = Container.useDispatch()
  const onClick = React.useCallback(
    () => dispatch(DeeplinksGen.createLink({link: props.link})),
    [dispatch, props.link]
  )

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
  const dispatch = Container.useDispatch()
  const {display, punycode, url} = props
  if (Styles.isMobile) {
    return (
      <Text
        className="hover-underline"
        type="BodyPrimaryLink"
        style={Styles.collapseStyles([props.wrapStyle, linkStyle, props.linkStyle])}
        title={display}
        onClick={() =>
          dispatch(
            RouteTreeGen.createNavigateAppend({
              path: [{props: {display, punycode, url}, selected: 'chatConfirmNavigateExternal'}],
            })
          )
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
  allowFontScaling?: boolean | null
  styleOverride: StyleOverride
  styles: {[K in string]: StylesTextCrossPlatform}
  disableBigEmojis: boolean
  disableEmojiAnimation: boolean
  messageType?: Types.MessageType
}

const ServiceDecoration = (p: Props) => {
  const {json, allowFontScaling, styles, styleOverride} = p
  const {disableBigEmojis, disableEmojiAnimation, messageType} = p
  // Parse JSON to get the type of the decoration
  let parsed: RPCChatTypes.UITextDecoration
  try {
    const jsonString = Buffer.from(toByteArray(json)).toString()
    parsed = JSON.parse(jsonString)
  } catch (e) {
    return null
  }
  if (parsed.typ === RPCChatTypes.UITextDecorationTyp.payment && messageType === 'text') {
    let paymentID: WalletTypes.PaymentID | undefined
    let error
    if (
      parsed.payment.result.resultTyp === RPCChatTypes.TextPaymentResultTyp.sent &&
      parsed.payment.result.sent
    ) {
      paymentID = WalletTypes.rpcPaymentIDToPaymentID(parsed.payment.result.sent)
    } else if (
      parsed.payment.result.resultTyp === RPCChatTypes.TextPaymentResultTyp.error &&
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
  } else if (parsed.typ === RPCChatTypes.UITextDecorationTyp.atmention && parsed.atmention) {
    return (
      <Mention
        allowFontScaling={allowFontScaling || false}
        style={styles.wrapStyle}
        username={parsed.atmention}
      />
    )
  } else if (parsed.typ === RPCChatTypes.UITextDecorationTyp.maybemention) {
    return (
      <MaybeMention
        allowFontScaling={allowFontScaling || false}
        style={styles.wrapStyle}
        name={parsed.maybemention.name}
        channel={parsed.maybemention.channel}
      />
    )
  } else if (parsed.typ === RPCChatTypes.UITextDecorationTyp.link) {
    const link = parsed.link.url
    const openUrl =
      link.toLowerCase().startsWith('http://') || link.toLowerCase().startsWith('https://')
        ? link
        : 'http://' + link
    return DeeplinksConstants.linkIsKeybaseLink(link) ? (
      <KeybaseLink link={link} linkStyle={styleOverride.link} wrapStyle={styles.wrapStyle} />
    ) : parsed.link.punycode ? (
      <WarningLink
        url={openUrl}
        display={parsed.link.url}
        punycode={parsed.link.punycode}
        linkStyle={styleOverride.link}
        wrapStyle={styles.wrapStyle}
      />
    ) : (
      <Text
        className="hover-underline hover_contained_color_blueDark"
        type="BodyPrimaryLink"
        style={Styles.collapseStyles([styles.wrapStyle, linkStyle, styleOverride.link])}
        title={parsed.link.url}
        onClickURL={openUrl}
        onLongPressURL={openUrl}
      >
        {parsed.link.url}
      </Text>
    )
  } else if (parsed.typ === RPCChatTypes.UITextDecorationTyp.mailto) {
    const openUrl = parsed.mailto.url.toLowerCase().startsWith('mailto:')
      ? parsed.mailto.url
      : 'mailto:' + parsed.mailto.url
    return (
      <Text
        className="hover-underline hover_contained_color_blueDark"
        type="BodyPrimaryLink"
        style={Styles.collapseStyles([styles.wrapStyle, linkStyle, styleOverride.mailto])}
        title={parsed.mailto.url}
        onClickURL={openUrl}
        onLongPressURL={openUrl}
      >
        {parsed.mailto.url}
      </Text>
    )
  } else if (parsed.typ === RPCChatTypes.UITextDecorationTyp.channelnamemention) {
    return (
      <Channel
        allowFontScaling={allowFontScaling || false}
        convID={parsed.channelnamemention.convID}
        name={parsed.channelnamemention.name}
        style={Styles.collapseStyles([styles.linkStyle, linkStyle, styleOverride.link])}
      />
    )
  } else if (parsed.typ === RPCChatTypes.UITextDecorationTyp.kbfspath) {
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
  } else if (parsed.typ === RPCChatTypes.UITextDecorationTyp.emoji) {
    return renderEmoji({
      customStyle: styleOverride.customEmoji,
      emoji: emojiDataToRenderableEmoji(RPCToEmojiData(parsed.emoji, disableEmojiAnimation)),
      showTooltip: !parsed.emoji.isReacji,
      size:
        parsed.emoji.isBig && !disableBigEmojis ? 32 : parsed.emoji.isReacji && !Styles.isMobile ? 18 : 16,
      style: styleOverride.emoji,
    })
  }
  return null
}

export default ServiceDecoration
