//
//  KBSharedFileList.h
//  KBKit
//
//  Created by Gabriel on 2/23/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBSharedFileList : NSObject

+ (void)findLoginItemForURL:(NSURL *)URL completion:(void (^)(LSSharedFileListRef fileListRef, CFArrayRef itemsRef, NSArray */*LSSharedFileListItemRef*/foundItems))completion;

+ (BOOL)isEnabledForURL:(NSURL *)URL type:(CFStringRef)type;

+ (BOOL)setEnabled:(BOOL)enabled URL:(NSURL *)URL name:(NSString *)name type:(CFStringRef)type insertAfter:(LSSharedFileListItemRef)insertAfter error:(NSError **)error;

+ (NSArray *)itemsForType:(CFStringRef)type;

+ (NSArray *)debugItemsForType:(CFStringRef)type;

@end
