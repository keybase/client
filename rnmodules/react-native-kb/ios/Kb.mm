#import "Kb.h"
#import <CoreTelephony/CTCarrier.h>
#import <CoreTelephony/CTTelephonyNetworkInfo.h>

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

// Don't compile this code when we build for the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeKbSpecJSI>(params);
}
#endif

@end
