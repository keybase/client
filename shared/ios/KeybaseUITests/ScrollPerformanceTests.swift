import XCTest

final class ScrollPerformanceTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        app.launchArguments.append("-PERF_FPS_MONITOR")
        app.launch()

        let chatTab = app.buttons["Chat"]
        if chatTab.waitForExistence(timeout: 60) {
            chatTab.tap()
        }

        // If we're inside a conversation, go back to inbox
        let inbox = app.otherElements["inboxList"].firstMatch
        if !inbox.waitForExistence(timeout: 10) {
            let backButton = app.buttons["Back"]
            if backButton.exists {
                backButton.tap()
            }
        }
    }

    override func tearDown() {
        // Background the app to trigger PerfFPSMonitor to write results via NSLog
        XCUIDevice.shared.press(.home)
        sleep(2)
    }

    private func openFirstConversation() {
        let inbox = app.otherElements["inboxList"].firstMatch
        XCTAssertTrue(inbox.waitForExistence(timeout: 15))

        let firstRow = inbox.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15))
        firstRow.tap()

        let messageList = app.otherElements["messageList"].firstMatch
        XCTAssertTrue(messageList.waitForExistence(timeout: 15))
    }

    func testInboxScrollPerformance() throws {
        let inbox = app.otherElements["inboxList"].firstMatch
        XCTAssertTrue(inbox.waitForExistence(timeout: 15))

        let start = CFAbsoluteTimeGetCurrent()
        for _ in 0..<5 {
            inbox.swipeUp(velocity: .fast)
        }
        for _ in 0..<5 {
            inbox.swipeDown(velocity: .fast)
        }
        let elapsed = CFAbsoluteTimeGetCurrent() - start
        NSLog("PERF_RESULT: testInboxScrollPerformance %.3f s", elapsed)
    }

    func testMessageListScrollPerformance() throws {
        openFirstConversation()

        let messageList = app.otherElements["messageList"].firstMatch

        // Message list is inverted — swipe down to scroll into history, up to come back
        let start = CFAbsoluteTimeGetCurrent()
        for _ in 0..<5 {
            messageList.swipeDown(velocity: .fast)
        }
        for _ in 0..<5 {
            messageList.swipeUp(velocity: .fast)
        }
        let elapsed = CFAbsoluteTimeGetCurrent() - start
        NSLog("PERF_RESULT: testMessageListScrollPerformance %.3f s", elapsed)
    }
}
