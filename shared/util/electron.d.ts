// cross platform view of electron just so actions can type correctly
type KB2 = {
  functions: {
    darwinCopyToKBFSTempUploadFile?: (originalFilePath: string) => Promise<string>
    darwinCopyToChatTempUploadFile?: (originalFilePath: string) => Promise<{outboxID: Buffer; path: string}>
  }
}

declare const kb2: KB2
export default kb2
