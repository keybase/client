import XCTest

final class ScrollPerformanceTests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
        app.launch()
        // Wait for app to load — look for the Chat tab button by accessibility label.
        // React Navigation renders tabs as plain buttons (not UITabBar), so use app.buttons.
        let chatTab = app.buttons["Chat"]
        XCTAssertTrue(chatTab.waitForExistence(timeout: 60))
        chatTab.tap()
    }

    func testInboxScrollPerformance() throws {
        let inbox = app.otherElements["inboxList"].firstMatch
        XCTAssertTrue(inbox.waitForExistence(timeout: 15))

        measure(metrics: [XCTClockMetric()]) {
            inbox.swipeUp(velocity: .fast)
            inbox.swipeDown(velocity: .fast)
        }
    }

    func testMessageListScrollPerformance() throws {
        // Tap first conversation
        let firstCell = app.cells.firstMatch
        XCTAssertTrue(firstCell.waitForExistence(timeout: 15))
        firstCell.tap()

        let messageList = app.otherElements["messageList"].firstMatch
        XCTAssertTrue(messageList.waitForExistence(timeout: 15))

        measure(metrics: [XCTClockMetric()]) {
            messageList.swipeUp(velocity: .fast)
            messageList.swipeDown(velocity: .fast)
        }
    }

    func testRapidScrollPerformance() throws {
        let firstCell = app.cells.firstMatch
        XCTAssertTrue(firstCell.waitForExistence(timeout: 15))
        firstCell.tap()

        let messageList = app.otherElements["messageList"].firstMatch
        XCTAssertTrue(messageList.waitForExistence(timeout: 15))

        // Rapid scroll — 10 swipes each direction
        measure(metrics: [XCTClockMetric()]) {
            for _ in 0..<10 {
                messageList.swipeUp(velocity: .fast)
            }
            for _ in 0..<10 {
                messageList.swipeDown(velocity: .fast)
            }
        }
    }
}
