sap.ui.define([
  "sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel", "sap/ui/model/Filter", "sap/ui/model/FilterOperator", "sap/m/MessageBox", "sap/m/MessageToast", "purchaseorderprocessing/controller/api"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, api) {
  "use strict";
  return Controller.extend("purchaseorderprocessing.controller.Supplier", {
    onInit: function () { this.getView().setModel(new JSONModel({ items: [], countText: "Loading..." }), "supplier"); this.getView().setModel(new JSONModel({ search: "", status: "", city: "" }), "filters"); this._load(); },
    _load: async function () { try { const r = await api.list("Suppliers"); this.getView().getModel("supplier").setData({ items: r.value || [], countText: `${(r.value || []).length} suppliers` }); } catch (e) { MessageBox.error(`Unable to load suppliers.\n\n${e.message}`); } },
    statusState: function (s) { return s === "Active" ? "Success" : "Error"; },
    onSearch: function () { const f = this.getView().getModel("filters").getData(), fs = []; if (f.search) fs.push(new Filter({ filters: [new Filter("name", FilterOperator.Contains, f.search), new Filter("ID", FilterOperator.Contains, f.search)], and: false })); if (f.status) fs.push(new Filter("status", FilterOperator.EQ, f.status)); if (f.city) fs.push(new Filter("city", FilterOperator.Contains, f.city)); this.byId("supplierTable").getBinding("items").filter(fs); },
    onClear: function () { this.getView().getModel("filters").setData({ search: "", status: "", city: "" }); this.byId("supplierTable").getBinding("items").filter([]); },
    onRefresh: function () { this._load(); },
    onCreate: function () {
      const form = new JSONModel({ ID: "", name: "", city: "", contact: "", email: "", phone: "", address: "", status: "Active" });
      const dialog = new sap.m.Dialog({ title: "Create Supplier", contentWidth: "32rem", content: [new sap.m.VBox({ class: "sapUiSmallMargin", items: [
        new sap.m.Label({ text: "Supplier ID *" }), new sap.m.Input({ value: "{form>/ID}" }),
        new sap.m.Label({ text: "Supplier Name *" }), new sap.m.Input({ value: "{form>/name}" }),
        new sap.m.Label({ text: "City" }), new sap.m.Input({ value: "{form>/city}" }),
        new sap.m.Label({ text: "Contact" }), new sap.m.Input({ value: "{form>/contact}" }),
        new sap.m.Label({ text: "Email" }), new sap.m.Input({ value: "{form>/email}" }),
        new sap.m.Label({ text: "Phone" }), new sap.m.Input({ value: "{form>/phone}" }),
        new sap.m.Label({ text: "Address" }), new sap.m.Input({ value: "{form>/address}" })
      ] })], beginButton: new sap.m.Button({ text: "Create", type: "Emphasized", press: async () => { const d = form.getData(); if (!d.ID || !d.name) return MessageBox.error("Supplier ID and name are required."); try { await api.create("Suppliers", d); MessageToast.show(`Supplier ${d.name} created.`); dialog.close(); this._load(); } catch (e) { MessageBox.error(e.message || "Unable to create supplier"); } } }), endButton: new sap.m.Button({ text: "Cancel", press: () => dialog.close() }) });
      dialog.setModel(form, "form"); dialog.attachAfterClose(() => dialog.destroy()); dialog.open();
    },
    onSupplierPress: function (e) { const s = e.getSource().getBindingContext("supplier").getObject(); MessageBox.information(`${s.name}\n${s.address || s.city}\n${s.contact || ""}\n${s.email || ""}\n${s.phone || ""}`, { title: `Supplier ${s.ID}` }); },
    onBack: function () { this.getOwnerComponent().getRouter().navTo("main"); }
  });
});
