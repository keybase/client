//
//  KBPGPOutputView.h
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppDefines.h"
#import "KBContentView.h"
#import "KBPGPOutputFooterView.h"

@interface KBPGPOutputView : KBContentView

@property (readonly) KBPGPOutputFooterView *footerView;

- (void)setASCIIData:(NSData *)data;

- (void)setText:(NSString *)text;

- (void)setPgpSigVerification:(KBRPgpSigVerification *)pgpSigVerification;

@end
