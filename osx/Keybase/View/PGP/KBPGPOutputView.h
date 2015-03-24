//
//  KBPGPOutputView.h
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBContentView.h"

@interface KBPGPOutputView : KBContentView

- (void)setArmoredData:(NSData *)data;

@end
