//
//  KBServiceConfig.h
//  Keybase
//
//  Created by Gabriel on 8/29/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBPath.h"
#import "KBEnvConfig.h"

@interface KBServiceConfig : NSObject

@property (readonly) NSString *versionPath;

- (instancetype)initWithConfig:(KBEnvConfig *)config;

- (NSDictionary *)launchdPlistDictionary;

- (NSString *)commandLineWithPathOptions:(KBPathOptions)pathOptions;

@end
