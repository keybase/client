import Foundation

@objc(AppBridge)
class AppBridge: NSObject {
  
  func getDevConfig(_ cb: RCTResponseSenderBlock) {
    let standardUserDefaults = UserDefaults.standard
    let registrationDomain = standardUserDefaults.volatileDomain(forName: UserDefaults.registrationDomain)
    let appDomain = standardUserDefaults.persistentDomain(forName: Bundle.main.bundleIdentifier!)
    
    var defaultValues: [String: AnyObject] = [:]
    var configuredValues: [String: AnyObject] = [:]
    
    for appDefault: AppDefault in [.APIServer, .RunMode, .HomeDirectory, .ReactHost] {
      let key = String(describing: appDefault)
      if let defaultValue = registrationDomain[key] {
        defaultValues[key] = defaultValue as AnyObject?
      }
      if let configuredValue = appDomain?[key] {
        configuredValues[key] = configuredValue as AnyObject?
      }
    }
    
    cb([[
      "keys": [AppDefault]([.HomeDirectory, .RunMode, .APIServer, .ReactHost]).map { $0.rawValue },
      "defaults": defaultValues,
      "configured": configuredValues
    ]])
  }
  
  func setDevConfig(_ newConfig: [String: AnyObject]) {
    for (k, v) in newConfig {
      guard let appDefault = AppDefault(rawValue: k) else {
        NSLog("Tried to set unknown default: \(k)")
        continue
      }
      appDefault.objectValue = (v is NSNull) ? nil : v
    }
    UserDefaults.standard.synchronize()
  }
  
}
