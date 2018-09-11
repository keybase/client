//
//  KBSharedFileList.h
//  KBKit
//
//  Created by Gabriel on 2/23/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBSharedFileList : NSObject

/*!
 Find login item in Finder favorites.

 @param completion firstPosition -1 means not found, 1 means first
 */
+ (void)findLoginItemForURL:(NSURL *)URL completion:(void (^)(LSSharedFileListRef fileListRef, CFArrayRef itemsRef, NSArray */*LSSharedFileListItemRef*/foundItems, NSInteger firstPosition))completion;

+ (BOOL)isEnabledForURL:(NSURL *)URL type:(CFStringRef)type;

+ (BOOL)setEnabled:(BOOL)enabled URL:(NSURL *)URL name:(NSString *)name type:(CFStringRef)type position:(NSInteger)position error:(NSError **)error;

+ (NSArray *)itemsForType:(CFStringRef)type;

+ (NSArray *)debugItemsForType:(CFStringRef)type;

+ (NSInteger)firstPositionForURL:(NSURL *)URL type:(CFStringRef)type;

+ (void)findItemAtPosition:(NSInteger)position type:(CFStringRef)type completion:(void (^)(LSSharedFileListItemRef itemRef))completion;

@end
