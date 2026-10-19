import XCTest

@testable import KBCommonShare

final class OwnFileTests: XCTestCase {
  private var base: URL!
  private var root: URL!
  private var outside: URL!
  private var roots: [String] { [ShareFiles.realPath(root.path)!] }
  private var secret: URL { root.appendingPathComponent("sub/secret") }
  private var dst: URL { outside.appendingPathComponent("copied") }

  override func setUpWithError() throws {
    base = FileManager.default.temporaryDirectory
      .appendingPathComponent("ownfile-\(UUID().uuidString)", isDirectory: true)
    root = base.appendingPathComponent("root", isDirectory: true)
    outside = base.appendingPathComponent("outside", isDirectory: true)
    let fm = FileManager.default
    try fm.createDirectory(at: root.appendingPathComponent("sub"), withIntermediateDirectories: true)
    try fm.createDirectory(at: outside, withIntermediateDirectories: true)
    try Data("secret".utf8).write(to: secret)
    try Data("fine".utf8).write(to: outside.appendingPathComponent("fine"))
  }

  override func tearDownWithError() throws {
    try? FileManager.default.removeItem(at: base)
  }

  private func assertRefused(_ src: URL, file: StaticString = #filePath, line: UInt = #line) {
    XCTAssertThrowsError(try ShareFiles.place(src, at: dst, move: false, roots: roots), file: file, line: line)
    XCTAssertFalse(FileManager.default.fileExists(atPath: dst.path), file: file, line: line)
  }

  func testOwnFileRefused() {
    assertRefused(secret)
  }

  func testDotDotIntoRootRefused() {
    assertRefused(URL(fileURLWithPath: outside.path + "/../root/sub/secret"))
  }

  func testSymlinkToOwnFileRefused() throws {
    let link = outside.appendingPathComponent("link")
    try FileManager.default.createSymbolicLink(at: link, withDestinationURL: secret)
    assertRefused(link)
  }

  func testPathThroughSymlinkedRootRefused() throws {
    let link = base.appendingPathComponent("rootlink")
    try FileManager.default.createSymbolicLink(at: link, withDestinationURL: root)
    assertRefused(link.appendingPathComponent("sub/secret"))
  }

  // A folder outside our roots can still hold links into them.
  func testFolderRefused() throws {
    let folder = outside.appendingPathComponent("folder", isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    try FileManager.default.createSymbolicLink(at: folder.appendingPathComponent("entry"), withDestinationURL: secret)
    assertRefused(folder)
  }

  func testFolderAboveRootRefused() {
    assertRefused(base)
  }

  func testOtherFileCopied() throws {
    try ShareFiles.place(outside.appendingPathComponent("fine"), at: dst, move: false, roots: roots)
    XCTAssertEqual(try Data(contentsOf: dst), Data("fine".utf8))
    XCTAssertFalse(try dst.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink ?? true)
  }

  // A provider's temp file is handed to us to move, wherever it is.
  func testMoveNotChecked() throws {
    let moved = outside.appendingPathComponent("moved")
    try ShareFiles.place(secret, at: moved, move: true, roots: roots)
    XCTAssertTrue(FileManager.default.fileExists(atPath: moved.path))
  }

  func testIsUnder() {
    XCTAssertTrue(ShareFiles.isUnder("/a/root", roots: ["/a/root"]))
    XCTAssertTrue(ShareFiles.isUnder("/a/root/x", roots: ["/a/root"]))
    XCTAssertTrue(ShareFiles.isUnder("/A/Root/x", roots: ["/a/root"]))
    XCTAssertFalse(ShareFiles.isUnder("/a/rootx/x", roots: ["/a/root"]))
    XCTAssertFalse(ShareFiles.isUnder("/a", roots: ["/a/root"]))
  }

  // On iOS the app's tmp, which holds the service's attachment stash, is
  // inside home.
  func testDefaultRootsCoverHome() {
    XCTAssertEqual(ShareFiles.ownRoots.first, ShareFiles.realPath(NSHomeDirectory()))
    XCTAssertTrue(ShareFiles.isUnder(ShareFiles.realPath(NSHomeDirectory() + "/Library")!, roots: ShareFiles.ownRoots))
  }
}
