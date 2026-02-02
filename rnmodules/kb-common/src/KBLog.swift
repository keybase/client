import Foundation

/// kbLog writes to stderr, which Go redirects to the log file after KeybaseInit.
/// Unlike NSLog (which uses os_log and doesn't go to stderr on iOS 10+), this
/// ensures native logs appear in the same log file as Go logs.
public func kbLog(_ format: String, _ args: CVarArg...) {
  let message = String(format: format, arguments: args)
  (message + "\n").withCString { fputs($0, stderr) }
}
