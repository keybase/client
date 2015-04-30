//
//  KBPGPDecryptView.h
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBContentView.h"
#import "KBPGPDecrypted.h"

@class KBPGPDecryptView;

typedef void (^KBPGPOnDecrypt)(KBPGPDecryptView *view, KBPGPDecrypted *decrypted);

@interface KBPGPDecryptView : KBContentView

@property (copy) KBPGPOnDecrypt onDecrypt;

- (void)setASCIIData:(NSData *)data;

@end
