//
//  KBKeyGenView.h
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBPGPKeyGenView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property (copy) dispatch_block_t completion;

@property KBButton *cancelButton;

@end
