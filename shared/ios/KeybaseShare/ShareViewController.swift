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

@objc(ShareViewController)
public class ShareViewController: UIViewController {
  var iph: ItemProviderHelper?
  var alert: UIAlertController?
  var selectedConvID: String?

  public override func didReceiveMemoryWarning() {
    super.didReceiveMemoryWarning()
  }

  func openApp() {
    let path = selectedConvID.map { "keybase://incoming-share/\($0)" } ?? "keybase://incoming-share"
    guard let url = URL(string: path) else { return }
    var responder: UIResponder? = self
    while let r = responder {
      if r.responds(to: #selector(UIApplication.openURL(_:))) {
        do {
          let sel = #selector(UIApplication.open(_:options:completionHandler:))
          if r.responds(to: sel) {
            let imp = r.method(for: sel)
            typealias Func = @convention(c) (AnyObject, Selector, URL, [UIApplication.OpenExternalURLOptionsKey: Any], ((Bool) -> Void)?) -> Void
            let f = unsafeBitCast(imp, to: Func.self)
            f(r, sel, url, [:], nil)
            return
          }
        }
      }
      responder = r.next
    }
  }

  func completeRequestAlreadyInMainThread() {
    alert?.dismiss(animated: true) {
      DispatchQueue.main.async {
        self.openApp()
        self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
      }
    }
  }

  func showProgressView() {
    let alertController = UIAlertController(title: "Working on it", message: "\n\nPreparing content for sharing into Keybase.", preferredStyle: .alert)
    alert = alertController
    let spinner = UIActivityIndicatorView(style: .medium)
    spinner.translatesAutoresizingMaskIntoConstraints = false
    spinner.startAnimating()
    alertController.view.addSubview(spinner)
    NSLayoutConstraint.activate([
      spinner.centerXAnchor.constraint(equalTo: alertController.view.centerXAnchor),
      spinner.centerYAnchor.constraint(equalTo: alertController.view.centerYAnchor, constant: -8)
    ])
    present(alertController, animated: true, completion: nil)
  }

  func closeProgressView() {
    alert?.dismiss(animated: true, completion: nil)
  }

  public override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    if let intent = extensionContext?.intent as? INSendMessageIntent {
      selectedConvID = intent.conversationIdentifier
    }
    let itemArrs = extensionContext?.inputItems.compactMap {
      ($0 as? NSExtensionItem)?.attachments
    } ?? []

    weak var weakSelf = self
    iph = ItemProviderHelper(forShare: true, withItems: itemArrs) {
      guard let self = weakSelf else { return }
      self.completeRequestAlreadyInMainThread()
    }
    showProgressView()
    iph?.startProcessing()
  }
}
