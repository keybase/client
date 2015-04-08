//
//  KBDeviceSignerOption.m
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDeviceSignerOption.h"

@implementation KBDeviceSignerOption

+ (instancetype)deviceWithIdentifier:(NSString *)identifier name:(NSString *)name {
  KBDeviceSignerOption *option = [[KBDeviceSignerOption alloc] init];
  option.signerType = KBDeviceSignerTypeDevice;
  option.identifier = identifier;
  option.title = name;
  option.info = @"Use this computer to get an authentication token.";
  option.imageURLString = @"bundle://30-Hardware-black-computer-30";
  return option;
}

+ (instancetype)PGP {
  KBDeviceSignerOption *option = [[KBDeviceSignerOption alloc] init];
  option.signerType = KBDeviceSignerTypePGP;
  option.title = @"PGP Key";
  option.info = @"Use your PGP key.";
  option.imageURLString = @"bundle://1-Edition-black-key-2-30";
  return option;
}

@end
