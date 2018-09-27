{
  // Instead of encoding all the bad cases into a more complicated regexp lets just add some simple code here
  // Note: We aren't trying to be 100% perfect here, just getting something that works pretty good and pretty quickly
  function visit(x, result, strs) {
    if (Array.isArray(x) ) {
      for (const y of x) {
        if (y) {
          visit(y, result, strs)
        }
      }
    } else if (typeof x === 'string') {
      strs.push(x)
    } else {
      if (strs.length) {
        result.push(strs.join(''))
        strs.splice(0)
      }
      result.push(x)
    }
  }

  function flatten (input) {
    const result = []
    const strs = []
    visit(input, result, strs)
    if (strs.length) {
      result.push(strs.join(''))
    }
    return result
  }
}

start
 = BlankLine* WhiteSpace* children:((Line LineTerminatorSequence / NonEndBlankLine)* Line?) BlankLine* WhiteSpace* { return {type: 'markup', children: flatten(children)} }

Line
 = (QuoteBlock / CodeBlock / TextBlock)+

BlankLine
 = children:WhiteSpace* LineTerminatorSequence { return {type: 'text-block', children} }

NonEndBlankLine
 = BlankLine !(BlankLine* WhiteSpace* !.)  // excludes groups of blank lines at the end of the input

// InlineStartCommon, InlineCont and InlineDelimiter are used by
// instantiations of __INLINE_RULE__.

InlineStartCommon
  = InlineCode / Phone / Italic / Bold / Link / Mention / Channel / Strike / Text / Emoji / NativeEmoji

InlineCont
 = !CodeBlock (Text / Emoji / NativeEmoji / EscapedChar / SpecialChar)

InlineDelimiter
 = WhiteSpace / PunctuationMarker

__INLINE_RULE__<TextInline, >

TextBlock
 = children:(TextInline / InlineDelimiter)+ { return {type: 'text-block', children: flatten(children)} }

Ticks1 = "`"
Ticks3 = "```"
EscapeMarker = "\\"
StrikeMarker = "~"
BoldMarker = "*"
ItalicMarker = "_"
EmojiMarker = ":"
QuoteBlockMarker = ">"
MentionMarker = "@"
ChannelMarker = "#"
PhoneMarker = "("
PhonePostfix = ")"

// Can mark the beginning of a link
PunctuationMarker = [()[\].,!?]

SpecialChar
 = EscapeMarker / StrikeMarker / MentionMarker / PhoneMarker / ChannelMarker / BoldMarker / ItalicMarker / EmojiMarker / QuoteBlockMarker / Ticks1 / PunctuationMarker { return text() }

EscapedChar
 = EscapeMarker char:SpecialChar { return char }

NormalChar
 = !NativeEmojiCharacter !SpecialChar NonBlank { return text() }

Text
 = NormalChar+ { return text() }

// TODO: should coalesce multiple line quotes
QuoteBlock
 = QuoteBlockMarker WhiteSpace* children:(CodeBlock / TextBlock)* LineTerminatorSequence? { return {type: 'quote-block', children: flatten(children)} }

__INLINE_RULE__<BoldInline, !BoldMarker>

Bold
 = BoldMarker !WhiteSpace children:BoldInline BoldMarker !(BoldMarker / NormalChar) { return {type: 'bold', children: flatten(children)} }

__INLINE_RULE__<ItalicInline, !ItalicMarker>

Italic
 = ItalicMarker !WhiteSpace children:ItalicInline ItalicMarker !(ItalicMarker / NormalChar) { return {type: 'italic', children: flatten(children)} }

__INLINE_RULE__<StrikeInline, !StrikeMarker>

Strike
 = StrikeMarker !WhiteSpace children:StrikeInline StrikeMarker !(StrikeMarker / NormalChar) { return {type: 'strike', children: flatten(children)} }

// children test adapted from CheckUsername in libkb/checkers.go.
Mention = MentionMarker username:($ ([a-zA-Z0-9]+"_"?)+) & {
  return username.length >= 2 && username.length <= 16 &&
    options && options.isValidMention && options.isValidMention(username)
} { return {type: 'mention', children: [username] } }

// children test adapted from validateTopicName in chat/msgchecker/plaintext_checker.go.
Channel
 = ChannelMarker name:($ ([0-9a-zA-Z_-]+)) & {
  return name.length > 0 && name.length <= 20 &&
    options && options.channelNameToConvID && options.channelNameToConvID(name)
} { return {type: 'channel', children: [name], convID: options && options.channelNameToConvID && options.channelNameToConvID(name) } }

Num = [0-9]
Phone
 = phone:($ (
   (PhoneMarker? Num Num Num PhonePostfix Space? Num Num Num [- ] Num Num Num Num !NonBlank) /
   (PhoneMarker? Num Num Num [- ] Num Num Num [- ] Num Num Num Num !NonBlank) /
   (PhoneMarker? Num Num Num Num Num Num Num Num Num Num !NonBlank))) {
    return {type: 'phone', href: 'tel:'+phone, children: [phone]}
   }

CodeBlock
 = Ticks3 LineTerminatorSequence? code:($ (!Ticks3 .)+) Ticks3 { return {type: 'code-block', children: [code]} }

InlineCode
 = Ticks1 code:($ (!Ticks1 !LineTerminatorSequence .)+) Ticks1 { return {type: 'inline-code', children: [code]} }

// Here we use the literal ":" because we want to not match the :foo in ::foo
InsideEmojiMarker
 = !EmojiMarker [a-zA-Z0-9+_-] { return text() }

InsideEmojiTone
 = "::skin-tone-" [1-6] { return text() }

Emoji
 = EmojiMarker children:InsideEmojiMarker+ tone:InsideEmojiTone? EmojiMarker { return {type: 'emoji', children: [text()]} }

NativeEmojiCharacter "unicode emoji"
 = [__EMOJI_CHARACTERS__]

NativeEmoji
 = emoji:(NativeEmojiCharacter+)
 {
   const emojiText = emoji.join('')
   const results = []
   let match
   let idx = 0
   while ((match = emojiExp.exec(emojiText)) !== null) {
     results.push(emojiText.substring(idx, match.index))
     results.push({type: 'native-emoji', children: [emojiIndexByChar[match[0]]]})
     idx = match.index + match[0].length
   }
   results.push(emojiText.substring(idx, emojiText.length))
   return results.filter(Boolean)
 }

LinkChar
 = !(SpecialChar+ (LineTerminatorSequence)) char:NonBlank { return char }

Link
  = url:( [([]* ("http"i "s"i? ":")? (LinkChar+) ) & {
    // All words basically go into this function so lets not make it slow
    const maybeQuote = url[0] || []
    const maybeProtocol = url[1] || []
    const maybeLink = [] = url[2] || []
    if (maybeLink.length < 4) { // 4 chars is the shortest a URL can be (i.e. t.co)
      return null
    }
    const link = maybeLink.join('')
    if (!tldExp.test(link)) { // includes a valid tld?
      if (!ipExp.test(link)) { // ip?
        return null
      }
    }
    let URL = maybeQuote.join('') + maybeProtocol.join('') + link

    /*
      From now on we're just deciding what to take off the beginnings / ends
      and what to keep. We keep track of what we've trimmed in `trailing` and
      `leading` and add it back in as plaintext at the end
    */

    /* Handle trailing periods etc. */
    const trailingPunctuationMatch = URL.match(/([\.,;:"!?])$/) // Match only after a period (we can't assume end parens aren't intended to be on the path)
    let trailing = ''
    if (trailingPunctuationMatch) { // remove + save trailing punctuation before starting
      trailing = trailingPunctuationMatch[0] + trailing
      URL = URL.substring(0, URL.length - trailing.length)
    }
    /* ============ */

    /* Remove matching brackets */
    let leading = ''
    const puncMap = {
      '(': ')',
      '[': ']',
    }
    while (URL[URL.length - 1] === puncMap[URL[0]] && URL.length > 4) {
      leading += URL[0]
      trailing = URL[URL.length - 1] + trailing
      URL = URL.substring(1, URL.length - 1)
    }
    /* ============ */

    /* Remove all leading punctuation ad-hoc */
    const leadingPunctuationMatch = URL.match(/^([()[\]"']+)/)
    if (leadingPunctuationMatch) { // remove + save leading punctuation before starting
      leading += leadingPunctuationMatch[0]
      URL = URL.substring(leading.length)
    }
    /* ============ */

    /* Remove all trailing punctuation if this is just a TLD (no /) */
    let tldPuncMatch = URL.match(tldPuncExp)
    if (tldPuncMatch) {
      const TLDTrailing = URL.match(/[)\].,;:"']+$/) // We already handled periods etc. in trailingPunctuationMatch (we can assume end parens aren't intended to be on a bare TLD)
      const addTrailing = TLDTrailing ? TLDTrailing[0] : ''
      trailing = addTrailing + trailing
      URL = URL.substring(0, URL.length - addTrailing.length)
    }
    /* ============ */

    const matches = linkExp.exec(URL)
    url._data = {leading, matches, trailing, URL}
    return matches
  } {
    const {leading, matches, trailing, URL} = url._data
    delete url._data
    let href = matches[0]
    if (!(href.toLowerCase().startsWith('http://') || href.toLowerCase().startsWith('https://'))) {
      href = 'http://' + href
    }
    return [leading, {type: 'link', href, children: [URL]}, trailing]
  }

NonBlank
 = !(WhiteSpace / LineTerminatorSequence) char:. { return char }

WhiteSpace
 = [\t\v\f \u00A0\uFEFF] / Space

LineTerminatorSequence "end of line"
 = (
   "\n"
   / "\r\n"
   / "\r"
   / "\u2028" // line separator
   / "\u2029" // paragraph separator
 ) { /* consume */ }

Space
 = [\u0020\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000]
