//
//  KBDeviceSignerOption.m
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDeviceSignerOption.h"

#import <Tikppa/Tikppa.h>

@implementation KBDeviceSignerOption

+ (instancetype)deviceWithDevice:(KBRDevice *)device {
  KBDeviceSignerOption *option = [[KBDeviceSignerOption alloc] init];
  option.signerType = KBDeviceSignerTypeDevice;
  option.device = device;
  option.title = device.name;
  option.info = NSStringWithFormat(@"Use the device named %@ to authorize this installation.", device.name);
  option.image = KBImageForDeviceType(device.type);
  return option;
}

+ (instancetype)PGP {
  KBDeviceSignerOption *option = [[KBDeviceSignerOption alloc] init];
  option.signerType = KBDeviceSignerTypePGP;
  option.title = @"PGP Key";
  option.info = @"Use your PGP key.";
  option.image = KBImageForDeviceType(@"pgp");
  return option;
}

@end


NSImage *KBImageForDeviceType(NSString *type) {
  if ([type isEqualTo:@"desktop"]) return [KBIcons imageForIcon:KBIconComputer];
  else if ([type isEqualTo:@"web"]) return [KBIcons imageForIcon:KBIconNetwork];
  else if ([type isEqualTo:@"pgp"]) return [KBIcons imageForIcon:KBIconPGP];
  else return nil;
}