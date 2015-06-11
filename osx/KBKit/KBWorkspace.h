//
//  KBWorkspace.h
//  Keybase
//
//  Created by Gabriel on 6/8/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBWorkspace : NSObject

+ (NSString *)applicationSupport:(NSArray *)subdirs create:(BOOL)create error:(NSError **)error;

+ (void)openURLString:(NSString *)URLString sender:(id)sender;

+ (NSUserDefaults *)userDefaults;

@end