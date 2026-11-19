sap.ui.define([
  "sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel", "sap/ui/model/Filter", "sap/ui/model/FilterOperator", "sap/m/MessageBox", "purchaseorderprocessing/controller/api"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, api) {
  "use strict";
  return Controller.extend("purchaseorderprocessing.controller.POList", {
    onInit: function () {
      this.getView().setModel(new JSONModel({ items: [], suppliers: [], countText: "Loading..." }), "list");
      this.getView().setModel(new JSONModel({ po: "", supplier: "", status: "", companyCode: "" }), "filters");
      this._load();
    },
    _load: async function () {
      try {
        const [poRes, itemRes, supplierRes] = await Promise.all([api.list("PurchaseOrders"), api.list("PurchaseOrderItems"), api.list("Suppliers")]);
        const itemsByPO = {};
        (itemRes.value || []).forEach(i => (itemsByPO[i.poNumber] ||= []).push(i));
        const suppliers = supplierRes.value || [];
        const supplierMap = Object.fromEntries(suppliers.map(s => [s.ID, s.name]));
        const items = (poRes.value || []).map(o => ({ ...o, supplierName: supplierMap[o.supplier_ID] || o.supplier_ID || "", netValue: (itemsByPO[o.poNumber] || []).reduce((s, i) => s + Number(i.netValue || 0), 0) }));
        this.getView().getModel("list").setData({ items, suppliers, countText: `${items.length} orders` });
      } catch (e) { MessageBox.error(`Unable to load Purchase Orders.\n\n${e.message}`); console.error(e); }
    },
    statusState: function (s) { return s === "Released" ? "Success" : s === "Pending" ? "Warning" : s === "Blocked" || s === "Rejected" ? "Error" : "None"; },
    onSearch: function () {
      const f = this.getView().getModel("filters").getData(), filters = [];
      if (f.po) filters.push(new Filter("poNumber", FilterOperator.Contains, f.po));
      if (f.supplier) filters.push(new Filter("supplier_ID", FilterOperator.EQ, f.supplier));
      if (f.status) filters.push(new Filter("status", FilterOperator.EQ, f.status));
      if (f.companyCode) filters.push(new Filter("companyCode", FilterOperator.EQ, f.companyCode));
      this.byId("poTable").getBinding("items").filter(filters);
      this.getView().getModel("list").setProperty("/countText", `${this.byId("poTable").getBinding("items").getLength()} orders`);
    },
    onClear: function () { this.getView().getModel("filters").setData({ po: "", supplier: "", status: "", companyCode: "" }); this.byId("poTable").getBinding("items").filter([]); this.getView().getModel("list").setProperty("/countText", `${this.getView().getModel("list").getProperty("/items").length} orders`); },
    onRefresh: function () { this._load(); },
    onPOPress: function (e) { this.getOwnerComponent().getRouter().navTo("poDetail", { poNumber: e.getSource().getBindingContext("list").getProperty("poNumber") }); },
    onCreate: function () { this.getOwnerComponent().getRouter().navTo("createPO"); },
    onBack: function () { this.getOwnerComponent().getRouter().navTo("main"); }
  });
});
