//
//  KBPath.h
//  Keybase
//
//  Created by Gabriel on 8/10/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBPath : NSObject

// Expands ~ and un-escapes "\ ". Returns nil for nil.
+ (NSString *)path:(NSString *)path;

// The expanded path, joined onto the expanded dir when dir is non-nil.
+ (NSString *)pathInDir:(NSString *)dir path:(NSString *)path;

@end
