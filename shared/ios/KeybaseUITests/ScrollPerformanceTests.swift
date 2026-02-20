import XCTest

final class ScrollPerformanceTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        app.launch()

        // Wait for the app to be ready — either on inbox or inside a conversation.
        // Try to find the Chat tab; if not found, we may already be on the chat screen.
        let chatTab = app.buttons["Chat"]
        if chatTab.waitForExistence(timeout: 30) {
            chatTab.tap()
        }

        // If we're inside a conversation, go back to inbox
        let inbox = app.otherElements["inboxList"].firstMatch
        if !inbox.waitForExistence(timeout: 5) {
            // Try tapping the back chevron
            let backButton = app.buttons["Back"]
            if backButton.exists {
                backButton.tap()
            }
        }
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
