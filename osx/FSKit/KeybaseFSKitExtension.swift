import Foundation

// NOTE:
// This is a scaffold for the native FSKit extension entry point.
// The actual operation handlers (lookup/read/write/xattr/readdir/etc.)
// should bridge to KBFS via IPC into the Go daemon.
@objc(KeybaseFSKitExtension)
final class KeybaseFSKitExtension: NSObject {
    @objc
    func beginRequest(with context: Any?) {
        // Extension host entrypoint placeholder.
        // Future work: attach IPC channel and initialize filesystem state.
    }
}
