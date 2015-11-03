//
//  KBTestView.h
//  Keybase
//
//  Created by Gabriel on 2/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBStyleGuideView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

- (void)open:(id)sender;

@end
