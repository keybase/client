//
//  KBFatalErrorView.h
//  Keybase
//
//  Created by Gabriel on 1/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBAppKit/KBAppKit.h>

@interface KBFatalErrorView : YOView

- (void)setError:(NSError *)error;

@end
