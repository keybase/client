#import <UIKit/UIKit.h>
#import <React/RCTComponent.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <React/RCTViewComponentView.h>
#endif

NS_ASSUME_NONNULL_BEGIN

#ifdef RCT_NEW_ARCH_ENABLED
@interface PasteableTextInputView : RCTViewComponentView
#else
@interface PasteableTextInputView : UIView
#endif

@property (nonatomic, copy, nullable) RCTDirectEventBlock onPasteImage;

@end

NS_ASSUME_NONNULL_END

