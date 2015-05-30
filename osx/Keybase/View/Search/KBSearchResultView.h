//
//  KBSearchResultView.h
//  Keybase
//
//  Created by Gabriel on 2/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppDefines.h"
#import "KBSearchResult.h"

@interface KBSearchResultView : KBImageTextView

@property (nonatomic) NSBackgroundStyle backgroundStyle;

- (void)setSearchResult:(KBSearchResult *)searchResult;

@end
