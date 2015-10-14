import Foundation

@objc(AppBridge)
class AppBridge: NSObject {
  
  func getDevConfig(cb: RCTResponseSenderBlock) {
    let standardUserDefaults = NSUserDefaults.standardUserDefaults()
    let registrationDomain = standardUserDefaults.volatileDomainForName(NSRegistrationDomain)
    let appDomain = standardUserDefaults.persistentDomainForName(NSBundle.mainBundle().bundleIdentifier!)
    
    var defaultValues: [String: AnyObject] = [:]
    var configuredValues: [String: AnyObject] = [:]
    
    for appDefault: AppDefault in [.APIServer, .RunMode, .HomeDirectory, .ReactHost] {
      let key = String(appDefault)
      if let defaultValue = registrationDomain[key] {
        defaultValues[key] = defaultValue
      }
      if let configuredValue = appDomain?[key] {
        configuredValues[key] = configuredValue
      }
    }
    
    cb([[
      "keys": [AppDefault]([.HomeDirectory, .RunMode, .APIServer, .ReactHost]).map { $0.rawValue },
      "defaults": defaultValues,
      "configured": configuredValues
    ]])
  }
  
  func setDevConfig(newConfig: [String: AnyObject]) {
    for (k, v) in newConfig {
      guard let appDefault = AppDefault(rawValue: k) else {
        NSLog("Tried to set unknown default: \(k)")
        continue
      }
      appDefault.objectValue = (v is NSNull) ? nil : v
    }
    NSUserDefaults.standardUserDefaults().synchronize()
  }
  
}