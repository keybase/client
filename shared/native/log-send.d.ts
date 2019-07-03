declare function logSend(
  status: string,
  feedback: string,
  sendLogs: boolean,
  sendMaxBytes: boolean,
  path: string,
  traceDir: string,
  cpuProfileDir: string
): Promise<string>

export default logSend
