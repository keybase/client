#import "GoJSIBridge.h"
#import <React/RCTBridge+Private.h>
#import <React/RCTUtils.h>
#import <jsi/jsi.h>
#import <sys/utsname.h>
#import "YeetJSIUtils.h"
#import <React/RCTBridge+Private.h>

using namespace facebook::jsi;
using namespace std;

static Engine * _engine = nil;

@implementation GoJSIBridge

@synthesize bridge = _bridge;
@synthesize methodQueue = _methodQueue;

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
    
    return YES;
}

+ (void)setEngine:(Engine *)engine {
  _engine = engine;
}

// Installing JSI Bindings as done by
// https://github.com/mrousavy/react-native-mmkv
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install)
{
    RCTBridge* bridge = [RCTBridge currentBridge];
    RCTCxxBridge* cxxBridge = (RCTCxxBridge*)bridge;
    if (cxxBridge == nil) {
        return @false;
    }

    auto jsiRuntime = (jsi::Runtime*) cxxBridge.runtime;
    if (jsiRuntime == nil) {
        return @false;
    }

    install(*(facebook::jsi::Runtime *)jsiRuntime, self);
    return @true;
}


- (NSString *) getModel {
    struct utsname systemInfo;
    uname(&systemInfo);
    return [NSString stringWithCString:systemInfo.machine encoding:NSUTF8StringEncoding];
}

- (void) setItem:(NSString * )key :(NSString *)value {
    NSUserDefaults *standardUserDefaults = [NSUserDefaults standardUserDefaults];
    [standardUserDefaults setObject:value forKey:key];
    [standardUserDefaults synchronize];
}

- (NSString *)getItem:(NSString *)key {
    NSUserDefaults *standardUserDefaults = [NSUserDefaults standardUserDefaults];
    return [standardUserDefaults stringForKey:key];
}

static void install(jsi::Runtime &jsiRuntime, GoJSIBridge *goJSIBridge) {
  auto rpcOnGo = Function::createFromHostFunction(jsiRuntime,
                                                  PropNameID::forAscii(jsiRuntime,
                                                                       "rpcOnGo"),
                                                  1,
                                                  [goJSIBridge](Runtime &runtime,
                                                           const Value &thisValue,
                                                           const Value *arguments,
                                                           size_t count) -> Value {
      
      NSString *s = convertJSIStringToNSString(runtime, arguments[0].getString(runtime));
    NSError *error = nil;
    [_engine rpcToGo:s];
    if (error) {
      NSLog(@"Error writing data: %@", error);
    }
      return Value(true);
  });
  jsiRuntime.global().setProperty(jsiRuntime, "rpcOnGo", move(rpcOnGo));
  
   /* auto getDeviceName = Function::createFromHostFunction(jsiRuntime,
                                                          PropNameID::forAscii(jsiRuntime,
                                                                               "getDeviceName"),
                                                          0,
                                                          [goJSIBridge](Runtime &runtime,
                                                                   const Value &thisValue,
                                                                   const Value *arguments,
                                                                   size_t count) -> Value {
        jsi::String deviceName = convertNSStringToJSIString(runtime, [goJSIBridge getModel]);
        return Value(runtime, deviceName);
    });
    
    jsiRuntime.global().setProperty(jsiRuntime, "getDeviceName", move(getDeviceName));
    
    auto setItem = Function::createFromHostFunction(jsiRuntime,
                                                    PropNameID::forAscii(jsiRuntime,
                                                                         "setItem"),
                                                    2,
                                                    [goJSIBridge](Runtime &runtime,
                                                             const Value &thisValue,
                                                             const Value *arguments,
                                                             size_t count) -> Value {
        
        NSString *key = convertJSIStringToNSString(runtime, arguments[0].getString(runtime));
        NSString *value = convertJSIStringToNSString(runtime, arguments[1].getString(runtime));
        [goJSIBridge setItem:key :value];
        return Value(true);
    });
    
    jsiRuntime.global().setProperty(jsiRuntime, "setItem", move(setItem));
    
    
    auto getItem = Function::createFromHostFunction(jsiRuntime,
                                                    PropNameID::forAscii(jsiRuntime,
                                                                         "getItem"),
                                                    0,
                                                    [goJSIBridge](Runtime &runtime,
                                                             const Value &thisValue,
                                                             const Value *arguments,
                                                             size_t count) -> Value {
        
        NSString *key = convertJSIStringToNSString(runtime, arguments[0].getString(runtime));
        NSString *value = [goJSIBridge getItem:key];
        return Value(runtime, convertNSStringToJSIString(runtime, value));
    });
    
    jsiRuntime.global().setProperty(jsiRuntime, "getItem", move(getItem));
    */
}

@end
