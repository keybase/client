//
//  Utils.m
//  Keybase
//
//  Created by Chris Nojima on 8/29/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import "Utils.h"
#import <CoreTelephony/CTCarrier.h>
#import <CoreTelephony/CTTelephonyNetworkInfo.h>

@implementation Utils

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_REMAP_METHOD(getDefaultCountryCode, resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  CTTelephonyNetworkInfo *network_Info = [CTTelephonyNetworkInfo new];
  CTCarrier *carrier = network_Info.subscriberCellularProvider;
  
  resolve(carrier.isoCountryCode);
}

@end
