//
//  KBPGPEncryptActionView.h
//  Keybase
//
//  Created by Gabriel on 6/9/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"
#import "KBPGPEncryptFooterView.h"
#import "KBDefines.h"

@interface KBPGPEncryptActionView : YOView

@property KBNavigationView *navigation;
@property (nonatomic) KBRPClient *client;

@property (nonatomic) NSExtensionItem *extensionItem;
@property (copy) KBOnExtension completion;

@end
