//
//  KBAppActions.h
//  Keybase
//
//  Created by Gabriel on 6/10/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBApp.h"

@interface KBAppActions : NSObject

@property (weak) KBApp *app;

- (IBAction)encrypt:(id)sender;
- (IBAction)encryptFile:(id)sender;
- (IBAction)decrypt:(id)sender;
- (IBAction)decryptFile:(id)sender;
- (IBAction)sign:(id)sender;
- (IBAction)signFile:(id)sender;
- (IBAction)signFiles:(id)sender;
- (IBAction)verify:(id)sender;
- (IBAction)verifyFile:(id)sender;

+ (NSView *)encryptWithExtensionItem:(NSExtensionItem *)extensionItem completion:(KBOnExtension)completion;

@end
