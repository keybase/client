//
//  KBMainView.h
//  Keybase
//
//  Created by Gabriel on 2/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"
#import "KBRPC.h"
#import "KBSourceView.h"

@interface KBMainView : YONSView <NSWindowDelegate, KBSourceViewDelegate> //, NSWindowRestoration>

@property (nonatomic) KBRUser *user;
@property (nonatomic, getter=isProgressEnabled) BOOL progressEnabled;

- (void)openWindow;

- (void)logout;

@end
