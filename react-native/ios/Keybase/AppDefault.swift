import Foundation

enum AppDefault: String {
  
  case APIServer = "APIServer"
  case RunMode = "RunMode"
  case HomeDirectory = "HomeDirectory"
  case ReactHost = "ReactHost"
  
  var objectValue: AnyObject? {
    get { return NSUserDefaults.standardUserDefaults().objectForKey(rawValue) }
    nonmutating set {
      if let newValue = newValue {
        NSUserDefaults.standardUserDefaults().setObject(newValue, forKey: rawValue)
      } else {
        NSUserDefaults.standardUserDefaults().removeObjectForKey(rawValue)
      }
    }
  }
  
  var stringValue: String? {
    get { return NSUserDefaults.standardUserDefaults().stringForKey(rawValue) }
    nonmutating set { objectValue = newValue }
  }
  
  func setDefaultValue(value: AnyObject) {
    NSUserDefaults.standardUserDefaults().registerDefaults([rawValue: value])
  }
  
}