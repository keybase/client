//
//  ShareViewController.swift
//  KeybaseShare
//
//  Created by Chris Nojima on 6/12/25.
//  Copyright © 2025 Keybase. All rights reserved.
//

import Foundation
import Intents
import UIKit
import MobileCoreServices
import Keybasego
import KBCommon
import os

private let log = Logger(subsystem: "com.keybase.app", category: "share-ext")

@objc(ShareViewController)
public class ShareViewController: UIViewController {
  var iph: ItemProviderHelper?
  var alert: UIAlertController?
  var selectedConvID: String?
  // viewDidAppear fires again when the progress alert is dismissed; only
  // process the share once.
  private var didStartProcessing = false

  // Work done, Cancel and the watchdog all end the share through finish(),
  // which acts only once. Main thread only.
  private var finished = false
  // The extension request is completed or cancelled exactly once, whichever
  // of finish's action, Cancel or a fallback timer gets there first.
  private var requestEnded = false
  private var alertPresented = false
  // Set when finish() runs before the alert's present animation has ended.
  private var afterPresent: (() -> Void)?
  private var watchdog: Timer?
  private var lastFraction = -1.0
  private var lastAdvance = Date()

  // A share whose progress hasn't moved for this long is treated as hung and
  // sent with what finished. This is only a backstop for a loader that never
  // returns: the user can tap Cancel at any time, and Photos/iCloud loaders
  // (rendering an edited or slo-mo video, an indeterminate iCloud fetch) can
  // sit for a long while without reporting progress, so it is generous.
  private static let stallTimeout: TimeInterval = 120
  // How often the stall check runs; it doesn't affect the deadline.
  private static let stallCheckInterval: TimeInterval = 1
  // UIKit can drop a present or dismiss completion (e.g. a dismiss issued
  // mid-transition), so the share never waits on one longer than these. The
  // present animation takes about 0.45s.
  private static let presentFallback: TimeInterval = 3
  private static let dismissFallback: TimeInterval = 1.5
  // The share ends this long after the failure alert goes up even if OK is
  // never tapped, so the alert can't hold the extension open.
  private static let failureAlertTimeout: TimeInterval = 10

  private enum Outcome {
    case done, stalled, cancelled
  }

  // What the share set out to prepare; 0 until processing starts, which reads
  // as plural.
  private var itemCount: Int { iph?.itemCount ?? 0 }

  private var manifestFailedMessage: String {
    itemCount == 1 ? "This item couldn't be saved for sharing." : "These items couldn't be saved for sharing."
  }

  private var stalledMessage: String {
    itemCount == 1 ? "Preparing this item took too long." : "Preparing these items took too long."
  }

  func openApp() {
    let path = selectedConvID.map { "keybase://incoming-share/\($0)" } ?? "keybase://incoming-share"
    guard let url = URL(string: path) else { return }
    let sel = #selector(UIApplication.open(_:options:completionHandler:))
    var responder: UIResponder? = self
    while let r = responder {
      if r.responds(to: sel) {
        let imp = r.method(for: sel)
        typealias Func = @convention(c) (AnyObject, Selector, URL, AnyObject?, ((Bool) -> Void)?) -> Void
        let f = unsafeBitCast(imp, to: Func.self)
        f(r, sel, url, nil, nil)
        return
      }
      responder = r.next
    }
    log.error("openApp: no responder can open the app")
  }

  private func openAppAndComplete() {
    guard !requestEnded else { return }
    requestEnded = true
    openApp()
    extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
  }

  private func cancelRequest() {
    guard !requestEnded else { return }
    requestEnded = true
    extensionContext?.cancelRequest(
      withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError))
  }

  private func finish(_ outcome: Outcome) {
    guard !finished else { return }
    finished = true
    watchdog?.invalidate()
    watchdog = nil
    switch outcome {
    case .done:
      // Everything failed: say so here rather than opening the app to an empty
      // share. A share with nothing we could even try still opens the app.
      let failed = iph?.failedCount ?? 0
      if iph?.manifestWritten == false {
        log.error("share failed: manifest not written")
        afterAlert { self.showFailureAndCancel(plural: self.itemCount != 1, message: self.manifestFailedMessage) }
      } else if !(iph?.hasPreparedItems ?? false) && failed > 0 {
        log.error("share failed: none of \(failed, privacy: .public) items could be prepared")
        afterAlert {
          self.showFailureAndCancel(
            plural: failed != 1,
            message: failed == 1
              ? "This item couldn't be prepared for sharing."
              : "None of these \(failed) items could be prepared for sharing.")
        }
      } else {
        afterAlert { self.openAppAndComplete() }
      }
    case .stalled:
      let hasItems = iph?.finishEarly() ?? false
      log.error(
        "share stalled for \(Self.stallTimeout, privacy: .public)s at \(self.lastFraction, privacy: .public); sending partial: \(hasItems, privacy: .public)"
      )
      afterAlert {
        if hasItems {
          self.openAppAndComplete()
        } else {
          // Items were ready but couldn't be saved, or none were ready in time.
          self.showFailureAndCancel(
            plural: self.itemCount != 1,
            message: self.iph?.hasPreparedItems == true
              ? self.manifestFailedMessage : self.stalledMessage)
        }
      }
    case .cancelled:
      log.log("share cancelled by user")
      iph?.cancel()
      afterAlert { self.cancelRequest() }
    }
  }

  // Cancel always ends the share. Once finish has run, its outcome may still be
  // waiting on an alert transition, so cancel the request directly.
  private func userCancelled() {
    guard finished else {
      finish(.cancelled)
      return
    }
    log.log("share cancelled by user while finishing")
    // Once the request has ended the app may be reading the manifest.
    guard !requestEnded else { return }
    // The app isn't opened for this share, so finish's manifest has no reader.
    iph?.removeManifest()
    cancelRequest()
  }

  // Tells the user the share couldn't be prepared, then cancels it on OK or
  // after failureAlertTimeout, whichever comes first. If afterAlert gave up on
  // the progress alert it is still on screen and UIKit would refuse a second
  // alert, so the share ends right away instead.
  private func showFailureAndCancel(plural: Bool, message: String) {
    guard !requestEnded else { return }
    // The app isn't opened for this share, so its manifest of failures has no
    // reader.
    iph?.removeManifest()
    guard presentedViewController == nil else {
      log.error("share: progress alert still up; cancelling without the failure alert")
      cancelRequest()
      return
    }
    let failure = UIAlertController(
      title: plural ? "Couldn't prepare these items" : "Couldn't prepare this item", message: message, preferredStyle: .alert)
    failure.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in self?.cancelRequest() })
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.failureAlertTimeout) { [weak self] in
      self?.cancelRequest()
    }
    present(failure, animated: true)
  }

  // Runs action once the alert is gone, without depending on any one UIKit
  // callback: it waits for the present animation if that is still running,
  // skips the dismiss if the alert is already leaving, and falls back to a
  // timer if a present or dismiss completion never comes.
  private func afterAlert(_ action: @escaping () -> Void) {
    var ran = false
    let once = {
      guard !ran else { return }
      ran = true
      action()
    }
    let dismiss = { [weak self] in
      guard let alert = self?.alert, alert.presentingViewController != nil, !alert.isBeingDismissed
      else {
        once()
        return
      }
      // Armed when the dismiss is issued, so a present still animating
      // doesn't eat into it.
      DispatchQueue.main.asyncAfter(deadline: .now() + Self.dismissFallback) {
        if !ran {
          log.error("share: alert never finished dismissing; completing anyway")
        }
        once()
      }
      alert.dismiss(animated: true) {
        DispatchQueue.main.async(execute: once)
      }
    }
    guard alert != nil else {
      once()
      return
    }
    if alertPresented {
      dismiss()
    } else {
      afterPresent = dismiss
      DispatchQueue.main.asyncAfter(deadline: .now() + Self.presentFallback) {
        if !ran {
          log.error("share: alert never finished presenting; completing anyway")
        }
        once()
      }
    }
  }

  private func startWatchdog() {
    let timer = Timer(timeInterval: Self.stallCheckInterval, repeats: true) { [weak self] _ in
      self?.checkForStall()
    }
    RunLoop.main.add(timer, forMode: .common)
    watchdog = timer
  }

  private func checkForStall() {
    guard let progress = iph?.progress else { return }
    let fraction = progress.fractionCompleted
    // Any movement counts: a late download adds units, which can pull the
    // fraction back down.
    if fraction != lastFraction {
      lastFraction = fraction
      lastAdvance = Date()
    } else if Date().timeIntervalSince(lastAdvance) >= Self.stallTimeout {
      finish(.stalled)
    }
  }

  func showProgressView() {
    let alertController = UIAlertController(title: "Working on it", message: "\n\nPreparing content for sharing into Keybase.", preferredStyle: .alert)
    alertController.addAction(
      UIAlertAction(title: "Cancel", style: .cancel) { [weak self] _ in
        self?.userCancelled()
      })
    alert = alertController
    let bar = UIProgressView(progressViewStyle: .default)
    bar.translatesAutoresizingMaskIntoConstraints = false
    bar.observedProgress = iph?.progress
    alertController.view.addSubview(bar)
    // Sits in the blank lines at the top of the message; the Cancel row below
    // pulls the alert's center down, hence the offset.
    NSLayoutConstraint.activate([
      bar.leadingAnchor.constraint(equalTo: alertController.view.leadingAnchor, constant: 32),
      bar.trailingAnchor.constraint(equalTo: alertController.view.trailingAnchor, constant: -32),
      bar.centerYAnchor.constraint(equalTo: alertController.view.centerYAnchor, constant: -38)
    ])
    present(alertController, animated: true) { [weak self] in
      guard let self else { return }
      self.alertPresented = true
      if let pending = self.afterPresent {
        self.afterPresent = nil
        pending()
      }
    }
  }

  public override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    guard !didStartProcessing else { return }
    didStartProcessing = true
    if let intent = extensionContext?.intent as? INSendMessageIntent {
      selectedConvID = intent.conversationIdentifier
    }
    let inputItems = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
    let extItems = ShareExtensionItems.shared(
      pageFlags: inputItems.map { ($0.userInfo?["supportsJavaScript"] as? Bool) == true },
      attachmentCounts: inputItems.map { $0.attachments?.count ?? 0 }
    ).map { inputItems[$0] }
    let itemArrs = extItems.map { $0.attachments ?? [] }
    let captions = extItems.map { $0.attributedContentText?.string ?? "" }

    iph = ItemProviderHelper(withItems: itemArrs, captions: captions) { [weak self] in
      self?.finish(.done)
    }
    showProgressView()
    startWatchdog()
    iph?.startProcessing()
  }
}
