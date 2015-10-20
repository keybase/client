import UIKit

func appDelegate() -> AppDelegate {
  return UIApplication.sharedApplication().delegate as! AppDelegate
}

@UIApplicationMain
@objc(AppDelegate)
class AppDelegate: UIResponder {
  
  var window: UIWindow?
  var engine: Engine!
  
  private func setupReactWithOptions(launchOptions: [NSObject: AnyObject]?) -> UIView {
    return RCTRootView(bundleURL: {
      
      #if DEBUG
        if let reactHost = AppDefault.ReactHost.stringValue {
          return NSURL(string: "http://\(reactHost)/react/index.bundle?platform=ios&dev=true")
        } else {
          return NSBundle.mainBundle().URLForResource("main", withExtension: "jsbundle")
        }
      #else
        return NSBundle.mainBundle().URLForResource("main", withExtension: "jsbundle")
      #endif
    }(), moduleName: "Keybase", initialProperties: nil, launchOptions: launchOptions)
  }
  
  private func setupEngine() {
    #if SIMULATOR
      let SecurityAccessGroupOverride = true
    #else
      let SecurityAccessGroupOverride = false
    #endif

    engine = Engine(settings: [
      "runmode": AppDefault.RunMode.stringValue!,
      "homedir": (NSHomeDirectory() as NSString).stringByAppendingPathComponent(AppDefault.HomeDirectory.stringValue ?? ""),
      "serverURI": AppDefault.APIServer.stringValue ?? "",
      "SecurityAccessGroupOverride": SecurityAccessGroupOverride
    ])
  }
  
}

extension AppDelegate: UIApplicationDelegate {

  func application(application: UIApplication, didFinishLaunchingWithOptions launchOptions: [NSObject : AnyObject]?) -> Bool {
    #if DEBUG
      AppDefault.RunMode.setDefaultValue("devel")
    #else
      AppDefault.RunMode.setDefaultValue("prod")
    #endif
    
    #if SIMULATOR
      AppDefault.ReactHost.setDefaultValue("localhost:8081")
    #else
      #if DEBUG
        // Uncomment if you want your device to hit a local server while debugging
//        AppDefault.ReactHost.setDefaultValue("192.168.1.50:8081")
//        AppDefault.APIServer.setDefaultValue("http://192.168.1.50:3000")
      #endif
    #endif

    setupEngine()
    
    let rootViewController = UIViewController()
    rootViewController.view = setupReactWithOptions(launchOptions)
    
    let window = UIWindow(frame: UIScreen.mainScreen().bounds)
    self.window = window
    window.rootViewController = rootViewController
    window.makeKeyAndVisible()
    return true
  }
  
}