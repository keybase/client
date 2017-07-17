//
//  KBPath.h
//  Keybase
//
//  Created by Gabriel on 8/10/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_OPTIONS (NSInteger, KBPathOptions) {
  KBPathOptionsEscape = 1 << 0,
  KBPathOptionsTilde = 1 << 1,
};

@interface KBPath : NSObject

+ (instancetype)path:(NSString *)path;

- (NSString *)pathWithOptions:(KBPathOptions)options;
- (NSString *)pathInDir:(NSString *)dir options:(KBPathOptions)options;

+ (NSString *)path:(NSString *)path options:(KBPathOptions)options;
+ (NSString *)pathInDir:(NSString *)dir path:(NSString *)path options:(KBPathOptions)options;

+ (BOOL)ensureDirectory:(NSString *)directory error:(NSError **)error;

@end

NSString *KBPathTilde(NSString *path);
