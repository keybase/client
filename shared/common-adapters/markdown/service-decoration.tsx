import React from 'react'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/chat2'
import * as WalletTypes from '../../constants/types/wallets'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as DeeplinksConstants from '../../constants/deeplinks'
import * as DeeplinksGen from '../../actions/deeplinks-gen'
import * as Styles from '../../styles'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {toByteArray} from 'base64-js'
import PaymentStatus from '../../chat/payments/status/container'
import Mention from '../mention-container'
import Channel from '../channel-container'
import KbfsPath from '../../fs/common/kbfs-path'
import MaybeMention from '../../chat/conversation/maybe-mention'
import Text, {StylesTextCrossPlatform} from '../text'
import {emojiDataToRenderableEmoji, renderEmoji, RPCToEmojiData} from '../../util/emoji'
import {StyleOverride} from '.'
import WithTooltip from '../with-tooltip'

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
  const {display, punycode} = props
  if (Styles.isMobile) {
    return (
      <Text
        className="hover-underline"
        type="BodyPrimaryLink"
        style={Styles.collapseStyles([props.wrapStyle, linkStyle, props.linkStyle])}
        title={props.display}
        onClick={() =>
          dispatch(
            RouteTreeGen.createNavigateAppend({
              path: [{props: {display, punycode}, selected: 'chatConfirmNavigateExternal'}],
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
      title={props.display}
      onClickURL={props.url}
      onLongPressURL={props.url}
    >
      <WithTooltip
        tooltip={props.punycode}
        containerStyle={Styles.platformStyles({
          isElectron: {
            display: 'inline-block',
          },
        })}
      >
        {props.display}
      </WithTooltip>
    </Text>
  )
}

export type Props = {
  json: string
  onClick?: () => void
  allowFontScaling?: boolean | null
  message?: Types.MessageText | Types.MessageAttachment
  styleOverride: StyleOverride
  styles: {[K in string]: StylesTextCrossPlatform}
  disableBigEmojis: boolean
  disableEmojiAnimation: boolean
}

const ServiceDecoration = (props: Props) => {
  // Parse JSON to get the type of the decoration
  let parsed: RPCChatTypes.UITextDecoration
  try {
    const json = Buffer.from(toByteArray(props.json)).toString()
    parsed = JSON.parse(json)
  } catch (e) {
    return null
  }
  if (
    parsed.typ === RPCChatTypes.UITextDecorationTyp.payment &&
    props.message &&
    props.message.type === 'text'
  ) {
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
        allowFontScaling={props.allowFontScaling}
        message={props.message}
      />
    )
  } else if (parsed.typ === RPCChatTypes.UITextDecorationTyp.atmention && parsed.atmention) {
    return (
      <Mention
        allowFontScaling={props.allowFontScaling || false}
        style={props.styles.wrapStyle}
        username={parsed.atmention}
      />
    )
  } else if (parsed.typ === RPCChatTypes.UITextDecorationTyp.maybemention) {
    return (
      <MaybeMention
        allowFontScaling={props.allowFontScaling || false}
        style={props.styles.wrapStyle}
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
      <KeybaseLink link={link} linkStyle={props.styleOverride.link} wrapStyle={props.styles.wrapStyle} />
    ) : parsed.link.punycode ? (
      <WarningLink
        url={openUrl}
        display={parsed.link.url}
        punycode={parsed.link.punycode}
        linkStyle={props.styleOverride.link}
        wrapStyle={props.styles.wrapStyle}
      />
    ) : (
      <Text
        className="hover-underline hover_contained_color_blueDark"
        type="BodyPrimaryLink"
        style={Styles.collapseStyles([props.styles.wrapStyle, linkStyle, props.styleOverride.link])}
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
        style={Styles.collapseStyles([props.styles.wrapStyle, linkStyle, props.styleOverride.mailto])}
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
        allowFontScaling={props.allowFontScaling || false}
        convID={parsed.channelnamemention.convID}
        name={parsed.channelnamemention.name}
        style={Styles.collapseStyles([props.styles.linkStyle, linkStyle, props.styleOverride.link])}
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
    return renderEmoji(
      emojiDataToRenderableEmoji(RPCToEmojiData(parsed.emoji, props.disableEmojiAnimation)),
      parsed.emoji.isBig && !props.disableBigEmojis
        ? 32
        : parsed.emoji.isReacji && !Styles.isMobile
        ? 18
        : 16,
      !parsed.emoji.isReacji,
      true
    )
  }
  return null
}

export default ServiceDecoration
