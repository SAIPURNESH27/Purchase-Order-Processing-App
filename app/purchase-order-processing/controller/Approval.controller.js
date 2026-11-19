sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/Text",
    "sap/m/TextArea",
    "sap/m/Button",
    "purchaseorderprocessing/controller/api"
], function (
    Controller,
    JSONModel,
    MessageBox,
    MessageToast,
    Dialog,
    Text,
    TextArea,
    Button,
    api
) {
    "use strict";

    return Controller.extend(
        "purchaseorderprocessing.controller.Approval",
        {

            // =========================================================
            // INITIALIZATION
            // =========================================================

            onInit: function () {

                this.getView().setModel(
                    new JSONModel({

                        items: [],

                        approved: [],

                        rejected: [],

                        pendingCount: 0,

                        loading: false

                    }),
                    "approval"
                );

                this._load();
            },


            // =========================================================
            // LOAD APPROVAL DATA
            // =========================================================

            _load: async function () {

                const m =
                    this.getView()
                        .getModel("approval");


                m.setProperty(
                    "/loading",
                    true
                );


                try {

                    const [
                        approvalRes,
                        poRes,
                        supplierRes
                    ] = await Promise.all([

                        api.list(
                            "Approvals"
                        ),

                        api.list(
                            "PurchaseOrders"
                        ),

                        api.list(
                            "Suppliers"
                        )

                    ]);


                    const purchaseOrders =
                        poRes.value || [];


                    const suppliers =
                        supplierRes.value || [];


                    const approvals =
                        approvalRes.value || [];


                    // -------------------------------------------------
                    // PO LOOKUP
                    // -------------------------------------------------

                    const poMap =
                        Object.fromEntries(

                            purchaseOrders.map(
                                function (po) {

                                    return [
                                        po.poNumber,
                                        po
                                    ];
                                }
                            )
                        );


                    // -------------------------------------------------
                    // SUPPLIER LOOKUP
                    // -------------------------------------------------

                    const supplierMap =
                        Object.fromEntries(

                            suppliers.map(
                                function (supplier) {

                                    return [
                                        supplier.ID,
                                        supplier.name
                                    ];
                                }
                            )
                        );


                    // -------------------------------------------------
                    // ENRICH APPROVAL DATA
                    // -------------------------------------------------

                    const all =
                        approvals.map(
                            function (approval) {

                                const po =
                                    poMap[
                                        approval.poNumber
                                    ];


                                const supplierName =
                                    approval.supplier ||
                                    supplierMap[
                                        po?.supplier_ID
                                    ] ||
                                    "";


                                return {

                                    ...approval,

                                    supplier:
                                        supplierName,

                                    amount:
                                        Number(
                                            approval.amount
                                        ) || 0,

                                    createdOn:
                                        approval.createdOn ||
                                        po?.documentDate ||
                                        "",

                                    createdBy:
                                        approval.createdBy ||
                                        po?.createdBy ||
                                        "",

                                    approver:
                                        approval.approver ||
                                        "",

                                    comments:
                                        approval.comments ||
                                        "",

                                    status:
                                        approval.status ||
                                        "Pending"
                                };
                            }
                        );


                    // -------------------------------------------------
                    // FILTER BY APPROVAL STATUS
                    // -------------------------------------------------

                    const pending =
                        all.filter(
                            function (item) {

                                return (
                                    item.status ===
                                    "Pending"
                                );
                            }
                        );


                    const approved =
                        all.filter(
                            function (item) {

                                return (
                                    item.status ===
                                    "Approved"
                                );
                            }
                        );


                    const rejected =
                        all.filter(
                            function (item) {

                                return (
                                    item.status ===
                                    "Rejected"
                                );
                            }
                        );


                    // -------------------------------------------------
                    // UPDATE MODEL
                    // -------------------------------------------------

                    m.setData({

                        items:
                            pending,

                        approved:
                            approved,

                        rejected:
                            rejected,

                        pendingCount:
                            pending.length,

                        loading:
                            false
                    });


                } catch (e) {

                    m.setProperty(
                        "/loading",
                        false
                    );


                    MessageBox.error(
                        `Unable to load approvals.\n\n${e.message}`
                    );


                    console.error(
                        "Approval load error:",
                        e
                    );
                }
            },


            // =========================================================
            // APPROVE PURCHASE ORDER
            // Pending Approval → Approved
            // =========================================================

            _approve: async function (
                poNumber
            ) {

                try {

                    await api.action(
                        "approvePurchaseOrder",
                        {

                            poNumber:
                                poNumber,

                            comment:
                                "Approved from Fiori approval worklist"
                        }
                    );


                    MessageToast.show(
                        `Purchase Order ${poNumber} approved.`
                    );


                    await this._load();


                } catch (e) {

                    MessageBox.error(
                        e.message ||
                        "Approval action failed."
                    );


                    throw e;
                }
            },


            // =========================================================
            // REJECT PURCHASE ORDER
            // Pending Approval → Rejected
            // =========================================================

            _reject: async function (
                poNumber,
                comment
            ) {

                try {

                    await api.action(
                        "rejectPurchaseOrder",
                        {

                            poNumber:
                                poNumber,

                            comment:
                                comment
                        }
                    );


                    MessageToast.show(
                        `Purchase Order ${poNumber} rejected.`
                    );


                    await this._load();


                } catch (e) {

                    MessageBox.error(
                        e.message ||
                        "Rejection action failed."
                    );


                    throw e;
                }
            },


            // =========================================================
            // APPROVE BUTTON
            // =========================================================

            onApprove: function (event) {

                const context =
                    event
                        .getSource()
                        .getBindingContext(
                            "approval"
                        );


                if (!context) {
                    return;
                }


                const poNumber =
                    context.getProperty(
                        "poNumber"
                    );


                MessageBox.confirm(
                    `Are you sure you want to approve Purchase Order ${poNumber}?`,
                    {

                        title:
                            "Approve Purchase Order",

                        actions: [

                            MessageBox.Action.OK,

                            MessageBox.Action.CANCEL
                        ],

                        emphasizedAction:
                            MessageBox.Action.OK,

                        onClose:
                            async function (action) {

                                if (
                                    action ===
                                    MessageBox.Action.OK
                                ) {

                                    await this._approve(
                                        poNumber
                                    );
                                }

                            }.bind(this)
                    }
                );
            },


            // =========================================================
            // REJECT BUTTON
            // =========================================================

            onReject: function (event) {

                const context =
                    event
                        .getSource()
                        .getBindingContext(
                            "approval"
                        );


                if (!context) {
                    return;
                }


                const poNumber =
                    context.getProperty(
                        "poNumber"
                    );


                this._openRejectDialog(
                    poNumber
                );
            },


            // =========================================================
            // REJECTION DIALOG
            // =========================================================

            _openRejectDialog:
                function (poNumber) {

                    const textArea =
                        new TextArea({

                            width:
                                "100%",

                            rows:
                                5,

                            placeholder:
                                "Enter reason for rejecting this purchase order..."
                        });


                    const dialog =
                        new Dialog({

                            title:
                                `Reject Purchase Order ${poNumber}`,

                            contentWidth:
                                "32rem",

                            content: [

                                new Text({

                                    text:
                                        "A rejection comment is required.",

                                    wrapping:
                                        true

                                }).addStyleClass(
                                    "sapUiSmallMarginBottom"
                                ),

                                textArea
                            ],


                            beginButton:
                                new Button({

                                    text:
                                        "Reject",

                                    type:
                                        "Reject",

                                    press:
                                        async function () {

                                            const comment =
                                                textArea
                                                    .getValue()
                                                    .trim();


                                            if (!comment) {

                                                MessageBox.warning(
                                                    "Please enter a rejection comment."
                                                );

                                                return;
                                            }


                                            dialog.setBusy(
                                                true
                                            );


                                            try {

                                                await this._reject(
                                                    poNumber,
                                                    comment
                                                );


                                                dialog.close();


                                            } catch (e) {

                                                dialog.setBusy(
                                                    false
                                                );
                                            }

                                        }.bind(this)
                                }),


                            endButton:
                                new Button({

                                    text:
                                        "Cancel",

                                    press:
                                        function () {

                                            dialog.close();

                                        }
                                }),


                            afterClose:
                                function () {

                                    dialog.destroy();

                                }
                        });


                    dialog.open();
                },


            // =========================================================
            // OPEN PO DETAIL
            // =========================================================

            onPOPress: function (event) {

                const poNumber =
                    event
                        .getSource()
                        .getText();


                this.getOwnerComponent()
                    .getRouter()
                    .navTo(
                        "poDetail",
                        {
                            poNumber:
                                poNumber
                        }
                    );
            },


            // =========================================================
            // REFRESH
            // =========================================================

            onRefresh: function () {

                this._load();
            },


            // =========================================================
            // TAB SELECTION
            // =========================================================

            onTabSelect: function () {

                // Data is already loaded into
                // the three tab models.
            },


            // =========================================================
            // BACK
            // =========================================================

            onBack: function () {

                this.getOwnerComponent()
                    .getRouter()
                    .navTo(
                        "main"
                    );
            }

        }
    );
});