//  Keybase
//
//  Created by Chris Nojima on 8/25/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

import Foundation

@objc(SwiftTest)
class SwiftTest: NSObject {

  @objc func example(prefix: String, callback: RCTResponseSenderBlock) -> Void {
    callback([prefix + " from Swift"])
  }

}