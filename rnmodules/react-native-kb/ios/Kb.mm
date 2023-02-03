#import "Kb.h"
#import "../cpp/rpc.h"
#import "Keybase.h"
#import <CoreTelephony/CTCarrier.h>
#import <CoreTelephony/CTTelephonyNetworkInfo.h>
#import <Foundation/Foundation.h>
#import <React/RCTBridge+Private.h>
#import <React/RCTBridge.h>
#import <React/RCTEventDispatcher.h>
#import <ReactCommon/CallInvoker.h>
#import <UserNotifications/UserNotifications.h>
#import <JavaScriptCore/JavaScriptCore.h>
#import <cstring>
#import <jsi/jsi.h>
#import <sys/utsname.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import "RNKbSpec.h"
#endif

using namespace facebook::jsi;
using namespace facebook;
using namespace std;

static const NSString *tagName = @"NativeLogger";
static NSString *const eventName = @"kb-engine-event";
static NSString *const metaEventName = @"kb-meta-engine-event";
static NSString *const metaEventEngineReset = @"kb-engine-reset";

@interface RCTBridge ()

- (JSGlobalContextRef)jsContextRef;
- (void *)runtime;
- (void)dispatchBlock:(dispatch_block_t)block queue:(dispatch_queue_t)queue;
- (std::shared_ptr<facebook::react::CallInvoker>)jsCallInvoker;

@end

@interface Kb ()
@property dispatch_queue_t readQueue;
@property(nonatomic, weak) RCTBridge *bridge;
@end

@implementation Kb
@synthesize bridge = _bridge;
@synthesize methodQueue = _methodQueue;

// sanity check the runtime isn't out of sync due to reload etc
void * currentRuntime = nil;

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (void)invalidate {
    currentRuntime = nil;
    [super invalidate];
    Teardown();
    self.bridge = nil;
    self.readQueue = nil;
    NSError *error = nil;
    KeybaseReset(&error);
}

- (void)sendToJS:(NSData *)data {
    __weak __typeof__(self) weakSelf = self;
    auto invoker = self.bridge.jsCallInvoker;
    
    if (!invoker) {
        NSLog(@"Failed to find invoker in sendToJS!!!");
        return;
    }
    
    invoker->invokeAsync([data, weakSelf]() {
        __typeof__(self) strongSelf = weakSelf;
        if (!strongSelf) {
            NSLog(@"Failed to find self in sendToJS invokeAsync!!!");
            return;
        }
        auto jsRuntimePtr = [strongSelf javaScriptRuntimePointer];
        if (!jsRuntimePtr) {
            NSLog(@"Failed to find jsi in sendToJS invokeAsync!!!");
            return;
        }
        
        int size = (int)[data length];
        auto& jsiRuntime = *jsRuntimePtr;
        auto values = PrepRpcOnJS(jsiRuntime, (uint8_t *)[data bytes], size);
        
        RpcOnJS(jsiRuntime, values, [](const std::string &err) {
            KeybaseLogToService([NSString stringWithFormat: @"dNativeLogger: [%f,\"jsi rpconjs error: %@\"]",
                      [[NSDate date] timeIntervalSince1970] * 1000,
                      [NSString stringWithUTF8String:err.c_str()]]);
        });
    });
}

- (jsi::Runtime *)javaScriptRuntimePointer
{
    if ([self.bridge respondsToSelector:@selector(runtime)]) {
        auto runtime = reinterpret_cast<jsi::Runtime *>(self.bridge.runtime);
        if (runtime == currentRuntime) {
            return runtime;
        }
        return nil;
    } else {
        return nil;
    }
}

// used to keep track of objects getting destroyed on the js side
class KBTearDown : public jsi::HostObject {
public:
    KBTearDown() {
        Tearup();
    }
    virtual ~KBTearDown() {
        NSLog(@"KBTeardown!!!");
        Teardown();
    }
    virtual jsi::Value get(jsi::Runtime &, const jsi::PropNameID &name) {
        return jsi::Value::undefined();
    }
    virtual void set(jsi::Runtime &, const jsi::PropNameID &name, const jsi::Value &value) {}
    virtual std::vector<jsi::PropNameID> getPropertyNames(jsi::Runtime &rt) {
        return {};
    }
};

- (void)installJsiBindings {
    // stash the current runtime to keep in sync
    currentRuntime = self.bridge.runtime;
    auto rpcOnGoWrap = [](Runtime &runtime, const Value &thisValue,
                          const Value *arguments, size_t count) -> Value {
        return RpcOnGo(runtime, thisValue, arguments, count,
                       [](void *ptr, size_t size) {
            NSData *result = [NSData dataWithBytesNoCopy:ptr
                                                  length:size
                                            freeWhenDone:NO];
            NSError *error = nil;
            KeybaseWriteArr(result, &error);
            if (error) {
                NSLog(@"Error writing data: %@", error);
            }
        });
    };
    
    auto jsRuntimePtr = [self javaScriptRuntimePointer];
    if (!jsRuntimePtr) {
        NSLog(@"Failed to install jsi!!!");
        return;
    }
    
    KeybaseLogToService([NSString stringWithFormat:@"dNativeLogger: [%f,\"jsi install success\"]",
             [[NSDate date] timeIntervalSince1970] * 1000]);
    
    
    auto& jsiRuntime = *jsRuntimePtr;
    // register the global JS uses to call go
    jsiRuntime.global().setProperty(jsiRuntime, "rpcOnGo",
                                    Function::createFromHostFunction(jsiRuntime,
                                                                     PropNameID::forAscii(jsiRuntime, "rpcOnGo"), 1, move(rpcOnGoWrap)));
    
    // register a global so we get notified when the runtime is killed so we can cleanup
    jsiRuntime.global().setProperty(jsiRuntime, "kbTeardown",
                                    jsi::Object::createFromHostObject(jsiRuntime, std::make_shared<KBTearDown>()));
}

RCT_REMAP_METHOD(getDefaultCountryCode, resolver
                 : (RCTPromiseResolveBlock)resolve rejecter
                 : (RCTPromiseRejectBlock)reject) {
    CTTelephonyNetworkInfo *network_Info = [CTTelephonyNetworkInfo new];
    CTCarrier *carrier = network_Info.subscriberCellularProvider;
    
    resolve(carrier.isoCountryCode);
}

RCT_REMAP_METHOD(logSend, status
                 : (NSString *)status feedback
                 : (NSString *)feedback sendLogs
                 : (BOOL)sendLogs sendMaxBytes
                 : (BOOL)sendMaxBytes traceDir
                 : (NSString *)traceDir cpuProfileDir
                 : (NSString *)cpuProfileDir resolver
                 : (RCTPromiseResolveBlock)resolve rejecter
                 : (RCTPromiseRejectBlock)reject) {
    
    NSString *logId = nil;
    NSError *err = nil;
    logId = KeybaseLogSend(status, feedback, sendLogs, sendMaxBytes, traceDir,
                           cpuProfileDir, &err);
    if (err == nil) {
        resolve(logId);
    } else {
        // Leave message nil so that err's message is used.
        reject(@"log_send_err", nil, err);
    }
}

RCT_REMAP_METHOD(iosGetHasShownPushPrompt, getHasShownPushPromptWithResolver
                 : (RCTPromiseResolveBlock)resolve rejecter
                 : (RCTPromiseRejectBlock)reject) {
    UNUserNotificationCenter *current =
    UNUserNotificationCenter.currentNotificationCenter;
    [current getNotificationSettingsWithCompletionHandler:^(
                                                            UNNotificationSettings *_Nonnull settings) {
                                                                if (settings.authorizationStatus == UNAuthorizationStatusNotDetermined) {
                                                                    // We haven't asked yet
                                                                    resolve(@FALSE);
                                                                    return;
                                                                }
                                                                resolve(@TRUE);
                                                                return;
                                                            }];
}


// from react-native-localize
- (bool)uses24HourClockForLocale:(NSLocale *_Nonnull)locale {
    NSDateFormatter *formatter = [NSDateFormatter new];
    
    [formatter setLocale:locale];
    [formatter setTimeZone:[NSTimeZone timeZoneForSecondsFromGMT:0]];
    [formatter setDateStyle:NSDateFormatterNoStyle];
    [formatter setTimeStyle:NSDateFormatterShortStyle];
    
    NSDate *date = [NSDate dateWithTimeIntervalSince1970:72000];
    return [[formatter stringFromDate:date] containsString:@"20"];
}

- (NSString *)setupServerConfig {
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSCachesDirectory,
                                                         NSUserDomainMask, YES);
    NSString *cachePath = [paths objectAtIndex:0];
    NSString *filePath = [cachePath
                          stringByAppendingPathComponent:@"/Keybase/keybase.app.serverConfig"];
    NSError *err;
    NSString *val = [NSString stringWithContentsOfFile:filePath
                                              encoding:NSUTF8StringEncoding
                                                 error:&err];
    if (err != nil || val == nil) {
        return @"";
    }
    return val;
}

- (NSString *)setupGuiConfig {
    id<KbProvider> kbProvider =
    (id<KbProvider>)[[UIApplication sharedApplication] delegate];
    NSString *filePath = [[kbProvider fsPaths][@"sharedHome"]
                          stringByAppendingPathComponent:
                              @"/Library/Application Support/Keybase/gui_config.json"];
    NSError *err;
    NSString *val = [NSString stringWithContentsOfFile:filePath
                                              encoding:NSUTF8StringEncoding
                                                 error:&err];
    if (err != nil || val == nil) {
        return @"";
    }
    return val;
}

RCT_EXPORT_METHOD(engineReset) {
    NSError *error = nil;
    KeybaseReset(&error);
    [self sendEventWithName:metaEventName body:metaEventEngineReset];
    if (error) {
        NSLog(@"Error in reset: %@", error);
    }
}

RCT_EXPORT_METHOD(engineStart) {
    __weak __typeof__(self) weakSelf = self;
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[NSNotificationCenter defaultCenter]
         addObserver:self
         selector:@selector(engineReset)
         name:RCTJavaScriptWillStartLoadingNotification
         object:nil];
        self.readQueue =
        dispatch_queue_create("go_bridge_queue_read", DISPATCH_QUEUE_SERIAL);
        
        dispatch_async(self.readQueue, ^{
            while (true) {
                {
                    __typeof__(self) strongSelf = weakSelf;
                    if (!strongSelf || !strongSelf.bridge) {
                        NSLog(@"Bridge dead, bailing");
                        return;
                    }
                }
                
                NSError *error = nil;
                NSData *data = KeybaseReadArr(&error);
                if (error) {
                    NSLog(@"Error reading data: %@", error);
                }
                else if (data) {
                    __typeof__(self) strongSelf = weakSelf;
                    if (strongSelf) {
                        [strongSelf sendToJS:data];
                    }
                }
            }
        });
    });
}

- (NSDictionary *)constantsToExport {
    [self installJsiBindings];
    NSString *serverConfig = [self setupServerConfig];
    NSString *guiConfig = [self setupGuiConfig];
    
    NSString *darkModeSupported = @"0";
    if (@available(iOS 13.0, *)) {
        darkModeSupported = @"1";
    };
    
    NSString *appVersionString = [[NSBundle mainBundle]
                                  objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
    if (appVersionString == nil) {
        appVersionString = @"";
    }
    NSString *appBuildString =
    [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];
    if (appBuildString == nil) {
        appBuildString = @"";
    }
    NSLocale *currentLocale = [NSLocale currentLocale];
    NSString *cacheDir = [NSSearchPathForDirectoriesInDomains(
                                                              NSCachesDirectory, NSUserDomainMask, YES) firstObject];
    NSString *downloadDir = [NSSearchPathForDirectoriesInDomains(
                                                                 NSDownloadsDirectory, NSUserDomainMask, YES) firstObject];
    
    NSString *kbVersion = KeybaseVersion();
    if (kbVersion == nil) {
        kbVersion = @"";
    }
    return @{
        @"androidIsDeviceSecure" : @NO,
        @"androidIsTestDevice" : @NO,
        @"appVersionCode" : appBuildString,
        @"appVersionName" : appVersionString,
        @"darkModeSupported" : darkModeSupported,
        @"fsCacheDir" : cacheDir,
        @"fsDownloadDir" : downloadDir,
        @"guiConfig" : guiConfig,
        @"serverConfig" : serverConfig,
        @"uses24HourClock" : @([self uses24HourClockForLocale:currentLocale]),
        @"version" : kbVersion
    };
}

- (NSArray<NSString *> *)supportedEvents {
    return @[ eventName, metaEventName ];
}

// Don't compile this code when we build for the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
(const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeKbSpecJSI>(params);
}
#endif

@end
