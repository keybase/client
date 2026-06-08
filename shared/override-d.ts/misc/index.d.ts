declare module 'emoji-datasource-apple/img/apple/sheets/64.png' {
  var png: string
  export default png
}

declare module 'emoji-datasource-apple' {
  type EmojiSkinTone = '1F3FA' | '1F3FB' | '1F3FC' | '1F3FD' | '1F3FE' | '1F3FF'
  export type EmojiData = {
    category: string
    name?: string
    obsoleted_by?: string
    short_name: string
    short_names: Array<string>
    sort_order: number
    skin_variations?: {[K in EmojiSkinTone]?: {unified?: string}}
    teamname?: string
    unified: string
    non_qualified: string
    userEmojiRenderStock?: string
    userEmojiRenderUrl?: string
    sheet_x: number
    sheet_y: number
  }
  const data: Array<EmojiData>
  export default data
}
