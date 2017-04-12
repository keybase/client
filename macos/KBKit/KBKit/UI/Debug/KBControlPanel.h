//
//  KBControlPanel.h
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"
#import "KBComponent.h"

@interface KBControlPanel : YOView <NSWindowDelegate>

@property KBNavigationView *navigation;
@property KBRPClient *client;

- (void)open:(id)sender;

- (void)addComponents:(NSArray */*of id<KBComponent>*/)components;

@end
