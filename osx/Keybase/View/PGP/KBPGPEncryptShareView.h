//
//  KBPGPEncryptShareView.h
//  Keybase
//
//  Created by Gabriel on 6/9/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppDefines.h"
#import "KBContentView.h"
#import "KBPGPEncryptFooterView.h"

typedef void (^KBPGPOnEncryptShare)(id sender, NSExtensionItem *outputItem);

@interface KBPGPEncryptShareView : KBContentView

@property NSExtensionItem *extensionItem;
@property (copy) KBPGPOnEncryptShare completion;

@end
