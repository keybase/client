const None = {
  functions: {} as {
    darwinCopyToKBFSTempUploadFile?: (dir: string, originalFilePath: string) => Promise<string>
    darwinCopyToChatTempUploadFile?: (dst: string, originalFilePath: string) => Promise<void>
    getPathForFile?: (file: File) => string
  },
}
export default None
