//
//  KBSemVersion.h
//  Keybase
//
//  Created by Gabriel on 8/21/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

/*!
 http://semver.org/spec/v2.0.0.html

 1.2.3-400
 Version = 1.2.3
 Build = 400
 Major = 1
 Minor = 2
 Patch = 3
 */
@interface KBSemVersion : NSObject

@property (readonly) NSString *version;
@property (readonly) NSInteger major;
@property (readonly) NSInteger minor;
@property (readonly) NSInteger patch;
@property (readonly) NSString *build;

+ (instancetype)version:(NSString *)version;
+ (instancetype)version:(NSString *)version build:(NSString *)build;

- (BOOL)isOrderedSame:(KBSemVersion *)v;
- (BOOL)isGreaterThan:(KBSemVersion *)v;
- (BOOL)isLessThan:(KBSemVersion *)v;

@end
