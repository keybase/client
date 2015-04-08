//
//  KBDeviceSignerOption.h
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"

typedef NS_ENUM (NSInteger, KBDeviceSignerType) {
  KBDeviceSignerTypeDevice,
  KBDeviceSignerTypePGP,
};

@interface KBDeviceSignerOption : NSObject

@property KBDeviceSignerType signerType;
@property NSString *identifier;
@property NSString *title;
@property NSString *info;
@property NSString *imageURLString;

+ (instancetype)deviceWithIdentifier:(NSString *)identifier name:(NSString *)name;

+ (instancetype)PGP;

@end
