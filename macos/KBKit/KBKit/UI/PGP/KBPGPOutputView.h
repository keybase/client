//
//  KBPGPOutputView.h
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import <Tikppa/Tikppa.h>
#import "KBRPC.h"
#import "KBPGPOutputFooterView.h"

@interface KBPGPOutputView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property (readonly) KBPGPOutputFooterView *footerView;

- (void)setText:(NSString *)text wrap:(BOOL)wrap;

- (void)setData:(NSData *)data armored:(BOOL)armored;

- (void)setPgpSigVerification:(KBRPGPSigVerification *)pgpSigVerification;

- (void)clear;

@end
