const None = {
  functions: {} as {
    darwinCopyToChatTempUploadFile?: (dst: string, originalFilePath: string) => Promise<void>
    getPathForFile?: (file: File) => string
    setNativeTheme?: (theme: 'dark' | 'light' | 'system') => Promise<void>
  },
}
export default None
