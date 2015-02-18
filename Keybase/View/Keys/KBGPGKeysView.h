//
//  KBGPGKeysView.h
//  Keybase
//
//  Created by Gabriel on 2/17/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"
#import "KBRPC.h"

@class KBGPGKeysView;

@protocol KBGPGKeysViewDelegate <NSObject>
- (void)GPGKeysView:(KBGPGKeysView *)GPGKeysView didSelectGPGKey:(KBRGPGKey *)GPGKey;
@end

@interface KBGPGKeysView : YONSView <NSTableViewDelegate, NSTableViewDataSource>

@property NSTableView *tableView;
@property NSScrollView *scrollView;

@property (weak) id<KBGPGKeysViewDelegate> delegate;

- (void)setGPGKeys:(NSArray */*of KBRGPGKey*/)GPGKeys;

- (KBRGPGKey *)selectedGPGKey;

@end
