sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/Device"
], function (UIComponent, Device) {
  "use strict";
  return UIComponent.extend("purchaseorderprocessing.Component", {
    metadata: { manifest: "json" },
    init: function () {
      UIComponent.prototype.init.apply(this, arguments);
      this.setModel(Device, "device");
      this.getRouter().initialize();
    }
  });
});