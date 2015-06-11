//
//  KBDeviceSignerOption.h
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"

typedef NS_ENUM (NSInteger, KBDeviceSignerType) {
  KBDeviceSignerTypeDevice,
  KBDeviceSignerTypePGP,
};

@interface KBDeviceSignerOption : NSObject

@property KBDeviceSignerType signerType;

@property KBRDevice *device;

@property NSString *title;
@property NSString *info;
@property NSImage *image;

+ (instancetype)deviceWithDevice:(KBRDevice *)device;

+ (instancetype)PGP;

@end


NSImage *KBImageForDeviceType(NSString *type);