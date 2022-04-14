#import "GoJSIBridge.h"
#import <React/RCTBridge+Private.h>
#import <React/RCTUtils.h>
#import <jsi/jsi.h>
#import <sys/utsname.h>
#import <cstring>
#import <React/RCTBridge+Private.h>
#import "AppDelegate.h"
#import "../../android/app/src/main/cpp/rpc.h"
#import "CocoaLumberjack.h"

using namespace facebook::jsi;
using namespace facebook;
using namespace std;

static Engine * _engine = nil;
static const DDLogLevel ddLogLevel = DDLogLevelDebug;
static const NSString* tagName = @"KBNativeLogger";

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


static Runtime *g_jsiRuntime = nullptr;
static RCTCxxBridge * g_cxxBridge = nullptr;

// Installing JSI Bindings as done by
// https://github.com/mrousavy/react-native-mmkv
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install)
{
    RCTBridge* bridge = [RCTBridge currentBridge];
    RCTCxxBridge* cxxBridge = (RCTCxxBridge*)bridge;
    if (cxxBridge == nil) {
        return @false;
    }

    auto jsiRuntime = (Runtime*)cxxBridge.runtime;
    if (jsiRuntime == nil) {
        return @false;
    }

    g_jsiRuntime = jsiRuntime;
    g_cxxBridge = cxxBridge;
    DDLogInfo(@"%@%@: [%@,\"%@\"]", @"d", @"KBNativeLogger",
            [NSString stringWithFormat:@"%f", [[NSDate date] timeIntervalSince1970] * 1000],
            @"jsi install success");
    install(*(Runtime *)jsiRuntime, self);
    return @true;
}

+ (void)sendToJS:(NSData*)data {
  int size = (int)[data length];
  auto values = PrepRpcOnJS(*g_jsiRuntime, (uint8_t*)[data bytes], size);
  auto invoker = [g_cxxBridge jsCallInvoker];
  invoker->invokeAsync([values]() {
    RpcOnJS(*g_jsiRuntime, values, [](const std::string & err) {
      DDLogInfo(@"%@%@: [%@,\"jsi rpconjs error: %@\"]", @"d", @"KBNativeLogger",
              [NSString stringWithFormat:@"%f", [[NSDate date] timeIntervalSince1970] * 1000],
              [NSString stringWithUTF8String:err.c_str()]);
    });
  });
}

static void install(Runtime &jsiRuntime, GoJSIBridge *goJSIBridge) {
  auto rpcOnGo = Function::createFromHostFunction(jsiRuntime,
    PropNameID::forAscii(jsiRuntime, "rpcOnGo"),
    1,
    [goJSIBridge](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
    return RpcOnGo(runtime, thisValue, arguments, count, [](void* ptr, size_t size) {
      NSData * result = [NSData dataWithBytesNoCopy:ptr length:size freeWhenDone:NO];
      [_engine rpcToGo: result];
    });
  });
  jsiRuntime.global().setProperty(jsiRuntime, "rpcOnGo", move(rpcOnGo));
}

@end
