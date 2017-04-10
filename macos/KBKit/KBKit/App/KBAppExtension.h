//
//  KBAppExtension.h
//  Keybase
//
//  Created by Gabriel on 6/10/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import "KBDefines.h"

@interface KBAppExtension : NSObject

- (NSView *)encryptViewWithExtensionItem:(NSExtensionItem *)extensionItem completion:(KBOnExtension)completion;

- (void)encryptExtensionItem:(NSExtensionItem *)extensionItem usernames:(NSArray *)usernames sender:(id)sender completion:(KBOnExtension)completion;

@end
