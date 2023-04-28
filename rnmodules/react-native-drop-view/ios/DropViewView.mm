#ifdef RCT_NEW_ARCH_ENABLED
#import "DropViewView.h"
#improt "DropView.h"
#import "../../../shared/ios/Keybase/ItemProviderHelper.h"
#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>
#import <react/renderer/components/RNDropViewViewSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNDropViewViewSpec/EventEmitters.h>
#import <react/renderer/components/RNDropViewViewSpec/Props.h>
#import <react/renderer/components/RNDropViewViewSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface DropViewView () <RCTDropViewViewProtocol>
@end

@implementation DropViewView {
  UIView *_view;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<DropViewViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps =
        std::make_shared<const DropViewViewProps>();
    _props = defaultProps;

    DropView *dv = [[DropView alloc] init];
    _view = dv;

    self.contentView = _view;
  }

  return self;
}

Class<RCTComponentViewProtocol> DropViewViewCls(void) {
  return DropViewView.class;
}

@end
#endif
