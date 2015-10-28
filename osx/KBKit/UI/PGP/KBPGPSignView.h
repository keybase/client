//
//  KBPGPSignView.h
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@class KBPGPSignView;

typedef void (^KBPGPOnSign)(KBPGPSignView *view, NSData *signedData, KBRSignMode mode);

@interface KBPGPSignView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property (copy) KBPGPOnSign onSign;

@end
