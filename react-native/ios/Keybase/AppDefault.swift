import Foundation

enum AppDefault {
  
  case APIServer, RunMode, HomeDirectory, ReactHost
  
  var stringValue: String? {
    get { return NSUserDefaults.standardUserDefaults().stringForKey(String(self)) }
    nonmutating set {
      if let newValue = newValue {
        NSUserDefaults.standardUserDefaults().setObject(newValue, forKey: String(self))
      } else {
        NSUserDefaults.standardUserDefaults().removeObjectForKey(String(self))
      }
    }
  }
  
}

extension String {
  init(_ appDefault: AppDefault) {
    switch appDefault {
    case .APIServer: self = "APIServer"
    case .RunMode: self = "RunMode"
    case .HomeDirectory: self = "HomeDirectory"
    case .ReactHost: self = "ReactHost"
    }
  }
}