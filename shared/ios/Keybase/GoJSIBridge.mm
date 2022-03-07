#import "GoJSIBridge.h"
#import <React/RCTBridge+Private.h>
#import <React/RCTUtils.h>
#import <jsi/jsi.h>
#import <sys/utsname.h>
#import <cstring>
#import <React/RCTBridge+Private.h>

using namespace facebook::jsi;
using namespace facebook;
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

    auto jsiRuntime = (Runtime*)cxxBridge.runtime;
    if (jsiRuntime == nil) {
        return @false;
    }

    install(*(Runtime *)jsiRuntime, self);
    return @true;
}

static Runtime *g_jsiRuntime = nullptr;

+ (void)sendToJS:(NSData*)data {
  Runtime & runtime = *g_jsiRuntime;
  Function rpcOnJs = runtime.global().getPropertyAsFunction(runtime, "rpcOnJs");
  Function arrayBufferCtor = runtime.global().getPropertyAsFunction(runtime, "ArrayBuffer");
  int kSize = (int)[data length];
  Value v = arrayBufferCtor.callAsConstructor(runtime, kSize);
  Object o = v.getObject(runtime);
  ArrayBuffer buf = o.getArrayBuffer(runtime);
  std::memcpy(buf.data(runtime), [data bytes], kSize);
  rpcOnJs.call(runtime, move(v), 1);
}

static void install(Runtime &jsiRuntime, GoJSIBridge *goJSIBridge) {
  g_jsiRuntime = &jsiRuntime;
  auto rpcOnGo = Function::createFromHostFunction(jsiRuntime,
    PropNameID::forAscii(jsiRuntime, "rpcOnGo"),
    1,
    [goJSIBridge](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
    auto obj = arguments[0].asObject(runtime);
    auto buffer = obj.getArrayBuffer(runtime);
    auto ptr = buffer.data(runtime);
    auto size = buffer.size(runtime);
    NSData * result = [NSData dataWithBytesNoCopy:ptr length:size freeWhenDone:NO];
    [_engine rpcToGo: result];
    return Value(true);
  });
  jsiRuntime.global().setProperty(jsiRuntime, "rpcOnGo", move(rpcOnGo));
}

@end
