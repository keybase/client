//
//  KBGPGKeysView.h
//  Keybase
//
//  Created by Gabriel on 2/17/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"

#import <Tikppa/Tikppa.h>

@class KBGPGKeysView;

@protocol KBGPGKeysViewDelegate <NSObject>
- (void)GPGKeysView:(KBGPGKeysView *)GPGKeysView didSelectGPGKey:(KBRGPGKey *)GPGKey;
@end

@interface KBGPGKeysView : KBTableView

@property (weak) id<KBGPGKeysViewDelegate> delegate;

- (void)setGPGKeys:(NSArray */*of KBRGPGKey*/)GPGKeys;

- (KBRGPGKey *)selectedGPGKey;

@end
