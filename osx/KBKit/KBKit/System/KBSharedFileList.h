//
//  KBSharedFileList.h
//  KBKit
//
//  Created by Gabriel on 2/23/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBSharedFileList : NSObject

+ (BOOL)setEnabled:(BOOL)enabled URL:(NSURL *)URL name:(NSString *)name type:(CFStringRef)type position:(NSInteger)position error:(NSError **)error;

+ (NSInteger)firstPositionForURL:(NSURL *)URL type:(CFStringRef)type;

+ (void)findItemAtPosition:(NSInteger)position type:(CFStringRef)type completion:(void (^)(LSSharedFileListItemRef itemRef))completion;

@end
