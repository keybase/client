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
  private var alertPresented = false
  // Set when finish() runs before the alert's present animation has ended.
  private var afterPresent: (() -> Void)?
  private var watchdog: Timer?
  private var lastFraction = -1.0
  private var lastAdvance = Date()

  // A share whose progress hasn't moved for this long is treated as hung and
  // sent with what finished. iCloud originals that are still downloading keep
  // advancing, so they are never cut off however long they take; the user can
  // always tap Cancel.
  private static let stallTimeout: TimeInterval = 30
  // UIKit can drop a dismiss completion (e.g. a dismiss issued mid-transition),
  // so the share never waits on one longer than this.
  private static let dismissFallback: TimeInterval = 1.5

  private enum Outcome {
    case done, stalled, cancelled
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
    openApp()
    extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
  }

  private func cancelRequest() {
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
      afterAlert { self.openAppAndComplete() }
    case .stalled:
      let hasItems = iph?.finishEarly() ?? false
      log.error(
        "share stalled for \(Self.stallTimeout, privacy: .public)s at \(self.lastFraction, privacy: .public); sending partial: \(hasItems, privacy: .public)"
      )
      afterAlert { hasItems ? self.openAppAndComplete() : self.cancelRequest() }
    case .cancelled:
      log.log("share cancelled by user")
      iph?.cancel()
      afterAlert { self.cancelRequest() }
    }
  }

  // Runs action once the alert is gone, without depending on any one UIKit
  // callback: it waits for the present animation if that is still running,
  // skips the dismiss if the alert is already leaving, and falls back to a
  // timer if the dismiss completion never comes.
  private func afterAlert(_ action: @escaping () -> Void) {
    var ran = false
    let once = {
      guard !ran else { return }
      ran = true
      action()
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.dismissFallback) {
      if !ran {
        log.error("share: alert never finished dismissing; completing anyway")
      }
      once()
    }
    guard alert != nil else {
      once()
      return
    }
    if alertPresented {
      dismissAlert(then: once)
    } else {
      afterPresent = { [weak self] in self?.dismissAlert(then: once) }
    }
  }

  private func dismissAlert(then done: @escaping () -> Void) {
    guard let alert, alert.presentingViewController != nil, !alert.isBeingDismissed else {
      done()
      return
    }
    alert.dismiss(animated: true) {
      DispatchQueue.main.async(execute: done)
    }
  }

  private func startWatchdog() {
    let timer = Timer(timeInterval: 1, repeats: true) { [weak self] _ in
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
        self?.finish(.cancelled)
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
    let itemArrs = extensionContext?.inputItems.compactMap {
      ($0 as? NSExtensionItem)?.attachments
    } ?? []

    iph = ItemProviderHelper(forShare: true, withItems: itemArrs) { [weak self] in
      self?.finish(.done)
    }
    showProgressView()
    startWatchdog()
    iph?.startProcessing()
  }
}
