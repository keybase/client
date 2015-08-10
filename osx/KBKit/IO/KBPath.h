//
//  KBPath.h
//  Keybase
//
//  Created by Gabriel on 8/10/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_OPTIONS (NSInteger, KBPathOptions) {
  KBPathOptionsEscape = 1 << 1,
  KBPathOptionsTilde = 1 << 2,
};

@interface KBPath : NSObject

+ (instancetype)path:(NSString *)path;

- (NSString *)pathWithOptions:(KBPathOptions)options;
- (NSString *)pathInDir:(NSString *)dir options:(KBPathOptions)options;

+ (NSString *)path:(NSString *)path options:(KBPathOptions)options;
+ (NSString *)pathInDir:(NSString *)dir path:(NSString *)path options:(KBPathOptions)options;

@end
