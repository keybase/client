//
//  KBPGPDecryptView.h
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"
#import "KBPGPDecrypted.h"

@class KBPGPDecryptView;

typedef void (^KBPGPOnDecrypt)(KBPGPDecryptView *view, KBPGPDecrypted *decrypted);

@interface KBPGPDecryptView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property (copy) KBPGPOnDecrypt onDecrypt;

- (void)setData:(NSData *)data armored:(BOOL)armored;

@end
