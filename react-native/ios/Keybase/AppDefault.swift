import Foundation

enum AppDefault: String {
  
  case APIServer = "APIServer"
  case RunMode = "RunMode"
  case HomeDirectory = "HomeDirectory"
  case ReactHost = "ReactHost"
  
  var objectValue: AnyObject? {
    get { return UserDefaults.standard.object(forKey: rawValue) as AnyObject? }
    nonmutating set {
      if let newValue = newValue {
        UserDefaults.standard.set(newValue, forKey: rawValue)
      } else {
        UserDefaults.standard.removeObject(forKey: rawValue)
      }
    }
  }
  
  var stringValue: String? {
    get { return UserDefaults.standard.string(forKey: rawValue) }
    nonmutating set { objectValue = newValue as AnyObject? }
  }
  
  func setDefaultValue(_ value: AnyObject) {
    UserDefaults.standard.register(defaults: [rawValue: value])
  }
  
}
