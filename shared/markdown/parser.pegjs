{
  // Instead of encoding all the bad cases into a more complicated regexp lets just add some simple code here
  // Note: We aren't trying to be 100% perfect here, just getting something that works pretty good and pretty quickly
  function goodLink (link) {
    return !link.match(dotDotExp) // disallow 'a...b', but allow /../
  }

  function flatten (input) {
    const result = []
    let strs = []

    function visit(x) {
      if (Array.isArray(x) ) {
        for (const y of x) {
          if (y) {
            visit(y)
          }
        }
      } else if (typeof x === 'string') {
        strs.push(x)
      } else {
        if (strs.length) {
          result.push(strs.join(''))
          strs = []
        }
        result.push(x)
      }
    }

    visit(input)
    if (strs.length) {
      result.push(strs.join(''))
    }
    return result
  }
}

start
 = children:(QuoteBlock / Line / BlankLine)* { return {type: 'text', children: flatten(children)} }

BlankLine
 = WhiteSpace* LineTerminatorSequence { return text() }

Line
 = (WhiteSpace* __INLINE_MACRO__<> / WhiteSpace+) LineTerminatorSequence?

InlineStart
 = CodeBlock / InlineCode / Italic / Bold / Strike / Link / InlineCont

InlineCont
 = Text / Emoji / EscapedChar / NativeEmoji / SpecialChar

Ticks1 = "`"
Ticks3 = "```"
EscapeMarker = "\\"
StrikeMarker = "~"
BoldMarker = "*"
ItalicMarker = "_"
EmojiMarker = ":"
QuoteBlockMarker = ">"

SpecialChar
 = EscapeMarker / StrikeMarker / BoldMarker / ItalicMarker / EmojiMarker / QuoteBlockMarker / Ticks1 { return text() }

EscapedChar
 = EscapeMarker char:SpecialChar { return char }

NormalChar
 = !NativeEmojiCharacter !SpecialChar NonBlank { return text() }

Text
 = NormalChar+ { return text() }

// TODO: should coalesce multiple line quotes
QuoteBlock
 = QuoteBlockMarker WhiteSpace* children:__INLINE_MACRO__<!LineTerminatorSequence> LineTerminatorSequence? { return {type: 'quote-block', children: flatten(children)} }

Bold
 = BoldMarker !WhiteSpace children:__INLINE_MACRO__<!BoldMarker> BoldMarker !(BoldMarker / NormalChar) { return {type: 'bold', children: flatten(children)} }

Italic
 = ItalicMarker !WhiteSpace children:__INLINE_MACRO__<!ItalicMarker> ItalicMarker !(ItalicMarker / NormalChar) { return {type: 'italic', children: flatten(children)} }

Strike
 = StrikeMarker !WhiteSpace children:__INLINE_MACRO__<!StrikeMarker> StrikeMarker !(StrikeMarker / NormalChar) { return {type: 'strike', children: flatten(children)} }

CodeBlock
 = Ticks3 LineTerminatorSequence? children:(!Ticks3 .)+ Ticks3 { return {type: 'code-block', children: flatten(children)} }

InlineCode
 = Ticks1 children:(!Ticks1 .)+ Ticks1 { return {type: 'inline-code', children: flatten(children)} }

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
     results.push({type: 'native-emoji', children: [emojiIndex[match[0]]]})
     idx = match.index + match[0].length
   }
   results.push(emojiText.substring(idx, emojiText.length))
   return results.filter(Boolean)
 }

LinkSpecialChar
 = EscapeMarker / StrikeMarker / BoldMarker

LinkChar
 = !LinkSpecialChar char:NonBlank { return char }

Link
 = proto:("http"i "s"i? ":")? url:(LinkChar+) & {
     const matches = url.join('').match(linkExp)
     if (!matches) {
       return false
     }
     const match = matches[0]
     url._match = match  // save the match via expando property (used below)
     return goodLink(match)
   }
 {
   const match = url._match
   delete url._match
   const urlText = url.join('')
   const protoText = proto ? proto.join('') : ''
   const href = (protoText || 'http://') + match
   const text = protoText + match
   return [
     {type: 'link', href, children: [text]},
     urlText.substring(match.length, urlText.length),
   ]
 }

NonBlank
 = !(WhiteSpace / LineTerminatorSequence) char:. { return char }

WhiteSpace
 = [\t\v\f \u00A0\uFEFF] / Space

LineTerminatorSequence "end of line"
 = "\n"
 / "\r\n"
 / "\r"
 / "\u2028" // line spearator
 / "\u2029" // paragraph separator

Space
 = [\u0020\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000]
