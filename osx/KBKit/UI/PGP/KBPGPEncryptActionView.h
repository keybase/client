//
//  KBPGPEncryptActionView.h
//  Keybase
//
//  Created by Gabriel on 6/9/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBContentView.h"
#import "KBPGPEncryptFooterView.h"

@interface KBPGPEncryptActionView : KBContentView

@property NSExtensionItem *extensionItem;
@property (copy) KBOnExtension completion;

@end
