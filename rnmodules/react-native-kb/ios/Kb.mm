#import "Kb.h"
#import <CoreTelephony/CTCarrier.h>
#import <CoreTelephony/CTTelephonyNetworkInfo.h>
#import "Keybase.h"

#ifdef RCT_NEW_ARCH_ENABLED
#import "RNKbSpec.h"
#endif

@implementation Kb
RCT_EXPORT_MODULE()

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

// Don't compile this code when we build for the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeKbSpecJSI>(params);
}
#endif

@end
