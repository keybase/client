//
//  NSDictionary+Extension.h
//  Updater
//
//  Created by Gabriel on 4/19/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface NSDictionary (Extension)

/*!
 Get BOOL value for key.
 @param key Key
 @result YES if boolValue; If key not found or is NSNull, returns NO.
 */
- (BOOL)kb_boolForKey:(id)key;

/*!
 NSString for key.
 @param key
 @result NSString
 */
- (NSString *)kb_stringForKey:(id)key;

/*!
 NSArray of NSString for key.
 @param key
 @result NSArray
 */
- (NSArray<NSString *> *)kb_stringArrayForKey:(id)key;

@end
