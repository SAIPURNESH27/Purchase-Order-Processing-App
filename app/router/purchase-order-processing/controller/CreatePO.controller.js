sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "purchaseorderprocessing/controller/api"
], function (
    Controller,
    JSONModel,
    MessageToast,
    MessageBox,
    api
) {
    "use strict";

    return Controller.extend(
        "purchaseorderprocessing.controller.CreatePO",
        {

            // =========================================================
            // INITIALIZATION
            // =========================================================

            onInit: function () {

                this.getOwnerComponent()
                    .getRouter()
                    .getRoute("createPO")
                    .attachPatternMatched(
                        () => this._newModel(),
                        this
                    );

                this.getOwnerComponent()
                    .getRouter()
                    .getRoute("editPO")
                    .attachPatternMatched(
                        this._loadEdit,
                        this
                    );

                this._newModel();
            },


            // =========================================================
            // WORKFLOW UI STATE
            // =========================================================

            _setWorkflowState: function (status) {

                const m =
                    this.getView().getModel("form");

                if (!m) {
                    return;
                }

                let canEdit = false;
                let canSave = false;
                let canSubmit = false;
                let canSendForApproval = false;

                switch (status) {

                    case "Draft":

                        canEdit = true;
                        canSave = true;
                        canSubmit = true;

                        break;


                    case "Submitted":

                        canEdit = false;
                        canSave = false;
                        canSubmit = false;
                        canSendForApproval = true;

                        break;


                    case "Pending Approval":
                    case "Approved":
                    case "Rejected":
                    case "Released":
                    case "Partially Received":
                    case "Fully Received":
                    case "Closed":
                    case "Cancelled":

                        canEdit = false;
                        canSave = false;
                        canSubmit = false;
                        canSendForApproval = false;

                        break;


                    default:

                        canEdit = true;
                        canSave = true;

                        break;
                }

                m.setProperty(
                    "/canEdit",
                    canEdit
                );

                m.setProperty(
                    "/canSave",
                    canSave
                );

                m.setProperty(
                    "/canSubmit",
                    canSubmit
                );

                m.setProperty(
                    "/canSendForApproval",
                    canSendForApproval
                );
            },


            // =========================================================
            // CREATE NEW PURCHASE ORDER
            // =========================================================

            _newModel: async function () {

                const d = new Date();

                const del =
                    new Date(
                        Date.now() +
                        9 * 86400000
                    );

                const fmt = function (x) {

                    return x
                        .toISOString()
                        .slice(0, 10);
                };


                const modelData = {

                    editMode: false,

                    poNumber: "",

                    status: "Draft",

                    approvalStatus: "Draft",

                    saved: false,

                    saving: false,

                    submitting: false,

                    supplierId: "",

                    companyCode: "1000",

                    purchasingOrg: "1000",

                    purchasingGroup: "IT1",

                    documentDate: fmt(d),

                    currency: "INR",

                    poType: "NB",

                    deliveryDate: fmt(del),

                    paymentTerms: "NET30",

                    incoterms: "FOB",

                    reference: "",

                    note: "",

                    suppliers: [],

                    items: [

                        {
                            itemNo: "10",

                            material: "",

                            description: "",

                            quantity: 1,

                            unit: "EA",

                            unitPrice: 0,

                            netValue: 0
                        }

                    ],

                    netValue: 0,

                    tax: 0,

                    totalValue: 0,

                    canEdit: true,

                    canSave: true,

                    canSubmit: false,

                    canSendForApproval: false
                };


                this.getView().setModel(
                    new JSONModel(modelData),
                    "form"
                );


                try {

                    const r =
                        await api.list(
                            "Suppliers"
                        );

                    this.getView()
                        .getModel("form")
                        .setProperty(
                            "/suppliers",
                            r.value || []
                        );

                } catch (e) {

                    MessageBox.error(
                        `Unable to load suppliers.\n\n${e.message}`
                    );
                }
            },


            // =========================================================
            // LOAD PURCHASE ORDER FOR EDIT
            // =========================================================

            _loadEdit: async function (e) {

                const po =
                    e.getParameter(
                        "arguments"
                    ).poNumber;

                await this._newModel();


                try {

                    const [
                        o,
                        itemsRes
                    ] = await Promise.all([

                        api.get(
                            "PurchaseOrders",
                            `'${po}'`
                        ),

                        api.query(
                            "PurchaseOrderItems",
                            `$filter=${encodeURIComponent(
                                `poNumber eq '${po}'`
                            )}`
                        )
                    ]);


                    const m =
                        this.getView()
                            .getModel("form");


                    const items =
                        (
                            itemsRes.value ||
                            []
                        ).map(
                            function (i, n) {

                                return {

                                    itemNo:
                                        String(
                                            (n + 1) * 10
                                        ),

                                    itemId:
                                        i.itemId,

                                    material:
                                        i.material || "",

                                    description:
                                        i.description || "",

                                    quantity:
                                        Number(
                                            i.quantity
                                        ) || 0,

                                    unit:
                                        i.unit || "EA",

                                    unitPrice:
                                        Number(
                                            i.unitPrice
                                        ) || 0,

                                    netValue:
                                        Number(
                                            i.netValue
                                        ) || 0
                                };
                            }
                        );


                    const status =
                        o.status || "Draft";


                    m.setData({

                        editMode: true,

                        poNumber:
                            o.poNumber,

                        status:
                            status,

                        approvalStatus:
                            o.approvalStatus ||
                            status,

                        saved: true,

                        saving: false,

                        submitting: false,

                        supplierId:
                            o.supplier_ID,

                        companyCode:
                            o.companyCode,

                        purchasingOrg:
                            o.purchasingOrg,

                        purchasingGroup:
                            o.purchasingGroup,

                        documentDate:
                            o.documentDate,

                        currency:
                            o.currency || "INR",

                        poType:
                            "NB",

                        deliveryDate:
                            o.deliveryDate || "",

                        paymentTerms:
                            o.paymentTerms ||
                            "NET30",

                        incoterms:
                            o.incoterms ||
                            "FOB",

                        reference:
                            o.reference || "",

                        note:
                            o.note || "",

                        suppliers:
                            m.getProperty(
                                "/suppliers"
                            ),

                        items:
                            items,

                        netValue: 0,

                        tax: 0,

                        totalValue: 0,

                        canEdit: false,

                        canSave: false,

                        canSubmit: false,

                        canSendForApproval: false
                    });


                    if (
                        !m.getProperty(
                            "/items"
                        ).length
                    ) {

                        m.setProperty(
                            "/items",
                            [
                                {
                                    itemNo: "10",

                                    material: "",

                                    description: "",

                                    quantity: 1,

                                    unit: "EA",

                                    unitPrice: 0,

                                    netValue: 0
                                }
                            ]
                        );
                    }


                    this._recalculate();

                    this._setWorkflowState(
                        status
                    );


                } catch (err) {

                    MessageBox.error(
                        `Unable to load Purchase Order ${po}.\n\n${err.message}`
                    );

                    console.error(err);
                }
            },


            // =========================================================
            // RECALCULATE TOTALS
            // =========================================================

            _recalculate: function () {

                const m =
                    this.getView()
                        .getModel("form");

                if (!m) {
                    return;
                }


                const items =
                    m.getProperty(
                        "/items"
                    ) || [];


                let net = 0;


                items.forEach(
                    function (
                        item,
                        index
                    ) {

                        const quantity =
                            Number(
                                item.quantity
                            ) || 0;

                        const unitPrice =
                            Number(
                                item.unitPrice
                            ) || 0;

                        const itemNet =
                            quantity *
                            unitPrice;

                        net += itemNet;


                        m.setProperty(
                            `/items/${index}/netValue`,
                            itemNet
                        );
                    }
                );


                const tax =
                    net * 0.18;

                const total =
                    net + tax;


                m.setProperty(
                    "/netValue",
                    net
                );

                m.setProperty(
                    "/tax",
                    tax
                );

                m.setProperty(
                    "/totalValue",
                    total
                );
            },


            // =========================================================
            // ITEM CHANGE
            // =========================================================

            onItemChange: function (event) {

                const input =
                    event.getSource();

                const context =
                    input.getBindingContext(
                        "form"
                    );

                if (!context) {
                    return;
                }


                const path =
                    context.getPath();

                const property =
                    input
                        .getBindingInfo(
                            "value"
                        )
                        ?.parts?.[0]?.path;


                if (
                    property === "quantity" ||
                    property === "unitPrice"
                ) {

                    const quantity =
                        Number(
                            context.getProperty(
                                "quantity"
                            )
                        ) || 0;

                    const unitPrice =
                        Number(
                            context.getProperty(
                                "unitPrice"
                            )
                        ) || 0;


                    const itemNet =
                        quantity *
                        unitPrice;


                    this.getView()
                        .getModel("form")
                        .setProperty(
                            `${path}/netValue`,
                            itemNet
                        );
                }


                this._recalculate();
            },


            // =========================================================
            // ADD ITEM
            // =========================================================

            onAddItem: function () {

                const m =
                    this.getView()
                        .getModel("form");

                const items =
                    m.getProperty(
                        "/items"
                    ) || [];


                if (
                    !m.getProperty(
                        "/canEdit"
                    )
                ) {

                    MessageToast.show(
                        "This Purchase Order is no longer editable."
                    );

                    return;
                }


                items.push({

                    itemNo:
                        String(
                            (items.length + 1) *
                            10
                        ),

                    material: "",

                    description: "",

                    quantity: 1,

                    unit: "EA",

                    unitPrice: 0,

                    netValue: 0
                });


                m.setProperty(
                    "/items",
                    items
                );

                this._recalculate();
            },


            // =========================================================
            // DELETE ITEM
            // =========================================================

            onDeleteItem: function (event) {

                const m =
                    this.getView()
                        .getModel("form");

                if (
                    !m.getProperty(
                        "/canEdit"
                    )
                ) {

                    MessageToast.show(
                        "This Purchase Order is no longer editable."
                    );

                    return;
                }


                const items =
                    m.getProperty(
                        "/items"
                    ) || [];


                const context =
                    event
                        .getSource()
                        .getBindingContext(
                            "form"
                        );


                if (!context) {
                    return;
                }


                const path =
                    context.getPath();


                const index =
                    Number(
                        path
                            .split("/")
                            .pop()
                    );


                if (
                    items.length === 1
                ) {

                    MessageToast.show(
                        "At least one item is required."
                    );

                    return;
                }


                items.splice(
                    index,
                    1
                );


                items.forEach(
                    function (
                        item,
                        n
                    ) {

                        item.itemNo =
                            String(
                                (n + 1) * 10
                            );
                    }
                );


                m.setProperty(
                    "/items",
                    items
                );

                this._recalculate();
            },


            // =========================================================
            // VALIDATION
            // =========================================================

            _validate: function (d) {

                if (
                    !d.supplierId ||
                    !d.companyCode ||
                    !d.purchasingOrg ||
                    !d.purchasingGroup ||
                    !d.documentDate
                ) {

                    return (
                        "Fill all mandatory header fields."
                    );
                }


                if (
                    !d.items ||
                    !d.items.length
                ) {

                    return (
                        "Add at least one item."
                    );
                }


                const invalid =
                    d.items.some(
                        function (item) {

                            return (

                                !item.material ||

                                Number(
                                    item.quantity
                                ) <= 0 ||

                                Number(
                                    item.unitPrice
                                ) < 0
                            );
                        }
                    );


                if (invalid) {

                    return (
                        "Enter valid material, quantity and " +
                        "unit price for every item."
                    );
                }


                return "";
            },


            // =========================================================
            // SAVE AS DRAFT
            // =========================================================

            onSave: async function () {

                const m =
                    this.getView()
                        .getModel("form");


                if (
                    !m.getProperty(
                        "/canSave"
                    )
                ) {

                    MessageToast.show(
                        "This Purchase Order cannot be edited in its current status."
                    );

                    return;
                }


                this._recalculate();


                const d =
                    m.getData();


                const error =
                    this._validate(d);


                if (error) {

                    MessageBox.error(
                        error
                    );

                    return;
                }


                m.setProperty(
                    "/saving",
                    true
                );


                try {

                    let po =
                        d.poNumber;


                    // =================================================
                    // EDIT EXISTING DRAFT
                    // =================================================

                    if (d.editMode) {

                        await api.patch(
                            "PurchaseOrders",
                            `'${po}'`,
                            {

                                supplier_ID:
                                    d.supplierId,

                                companyCode:
                                    d.companyCode,

                                purchasingOrg:
                                    d.purchasingOrg,

                                purchasingGroup:
                                    d.purchasingGroup,

                                documentDate:
                                    d.documentDate,

                                deliveryDate:
                                    d.deliveryDate,

                                paymentTerms:
                                    d.paymentTerms,

                                incoterms:
                                    d.incoterms,

                                reference:
                                    d.reference,

                                note:
                                    d.note
                            }
                        );


                        const old =
                            await api.query(
                                "PurchaseOrderItems",
                                `$filter=${encodeURIComponent(
                                    `poNumber eq '${po}'`
                                )}`
                            );


                        for (
                            const item
                            of (
                                old.value ||
                                []
                            )
                        ) {

                            await api.remove(
                                "PurchaseOrderItems",
                                `'${item.itemId}'`
                            );
                        }
                    }


                    // =================================================
                    // CREATE NEW DRAFT
                    // =================================================

                    else {

                        const created =
                            await api.create(
                                "PurchaseOrders",
                                {

                                    supplier_ID:
                                        d.supplierId,

                                    companyCode:
                                        d.companyCode,

                                    purchasingOrg:
                                        d.purchasingOrg,

                                    purchasingGroup:
                                        d.purchasingGroup,

                                    documentDate:
                                        d.documentDate,

                                    currency:
                                        d.currency,

                                    status:
                                        "Draft",

                                    approvalStatus:
                                        "Draft",

                                    createdBy:
                                        "Sai Purnesh",

                                    deliveryDate:
                                        d.deliveryDate,

                                    paymentTerms:
                                        d.paymentTerms,

                                    incoterms:
                                        d.incoterms,

                                    reference:
                                        d.reference,

                                    note:
                                        d.note
                                }
                            );


                        po =
                            created.poNumber;
                    }


                    // =================================================
                    // SAVE ITEMS
                    // =================================================

                    for (
                        const item
                        of d.items
                    ) {

                        await api.create(
                            "PurchaseOrderItems",
                            {

                                itemId:
                                    `${po}-${item.itemNo}`,

                                poNumber:
                                    po,

                                material:
                                    item.material,

                                description:
                                    item.description,

                                quantity:
                                    Number(
                                        item.quantity
                                    ),

                                unit:
                                    item.unit,

                                unitPrice:
                                    Number(
                                        item.unitPrice
                                    ),

                                netValue:
                                    Number(
                                        item.quantity
                                    ) *
                                    Number(
                                        item.unitPrice
                                    ),

                                status:
                                    "Open"
                            }
                        );
                    }


                    // =================================================
                    // UPDATE LOCAL MODEL
                    // =================================================

                    m.setProperty(
                        "/editMode",
                        true
                    );

                    m.setProperty(
                        "/poNumber",
                        po
                    );

                    m.setProperty(
                        "/status",
                        "Draft"
                    );

                    m.setProperty(
                        "/approvalStatus",
                        "Draft"
                    );

                    m.setProperty(
                        "/saved",
                        true
                    );


                    this._setWorkflowState(
                        "Draft"
                    );


                    MessageToast.show(
                        `Purchase Order ${po} saved as Draft.`
                    );


                } catch (e) {

                    MessageBox.error(
                        `Unable to save Purchase Order.\n\n${e.message}`
                    );

                    console.error(e);

                } finally {

                    m.setProperty(
                        "/saving",
                        false
                    );
                }
            },


            // =========================================================
            // SUBMIT
            // Draft → Submitted
            // =========================================================

            onSubmit: function () {

                const m =
                    this.getView()
                        .getModel("form");

                const po =
                    m.getProperty(
                        "/poNumber"
                    );


                if (!po) {

                    MessageBox.warning(
                        "Please save the Purchase Order as a Draft before submitting."
                    );

                    return;
                }


                if (
                    m.getProperty(
                        "/status"
                    ) !== "Draft"
                ) {

                    MessageBox.warning(
                        "Only Draft Purchase Orders can be submitted."
                    );

                    return;
                }


                MessageBox.confirm(
                    `Submit Purchase Order ${po}?`,
                    {

                        title:
                            "Submit Purchase Order",

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

                                    await this._submitPurchaseOrder(
                                        po
                                    );
                                }
                            }.bind(this)
                    }
                );
            },


            _submitPurchaseOrder:
                async function (po) {

                    const m =
                        this.getView()
                            .getModel("form");


                    m.setProperty(
                        "/submitting",
                        true
                    );


                    try {

                        await api.action(
                            "submitPurchaseOrder",
                            {
                                poNumber: po
                            }
                        );


                        m.setProperty(
                            "/status",
                            "Submitted"
                        );

                        m.setProperty(
                            "/approvalStatus",
                            "Submitted"
                        );


                        this._setWorkflowState(
                            "Submitted"
                        );


                        MessageToast.show(
                            `Purchase Order ${po} submitted successfully.`
                        );


                    } catch (e) {

                        MessageBox.error(
                            `Unable to submit Purchase Order ${po}.\n\n${e.message}`
                        );

                    } finally {

                        m.setProperty(
                            "/submitting",
                            false
                        );
                    }
                },


            // =========================================================
            // SEND FOR APPROVAL
            // Submitted → Pending Approval
            // =========================================================

            onSendForApproval: function () {

                const m =
                    this.getView()
                        .getModel("form");

                const po =
                    m.getProperty(
                        "/poNumber"
                    );


                if (!po) {

                    MessageBox.warning(
                        "Purchase Order number is missing."
                    );

                    return;
                }


                if (
                    m.getProperty(
                        "/status"
                    ) !== "Submitted"
                ) {

                    MessageBox.warning(
                        "Only Submitted Purchase Orders can be sent for approval."
                    );

                    return;
                }


                MessageBox.confirm(
                    `Send Purchase Order ${po} for approval?`,
                    {

                        title:
                            "Send for Approval",

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

                                    await this._sendForApproval(
                                        po
                                    );
                                }
                            }.bind(this)
                    }
                );
            },


            _sendForApproval:
                async function (po) {

                    const m =
                        this.getView()
                            .getModel("form");


                    m.setProperty(
                        "/submitting",
                        true
                    );


                    try {

                        await api.action(
                            "sendForApproval",
                            {
                                poNumber: po
                            }
                        );


                        m.setProperty(
                            "/status",
                            "Pending Approval"
                        );

                        m.setProperty(
                            "/approvalStatus",
                            "Pending Approval"
                        );


                        this._setWorkflowState(
                            "Pending Approval"
                        );


                        MessageToast.show(
                            `Purchase Order ${po} is now pending approval.`
                        );


                        // Go to PO detail after entering
                        // the approval workflow.
                        this.getOwnerComponent()
                            .getRouter()
                            .navTo(
                                "poDetail",
                                {
                                    poNumber: po
                                }
                            );


                    } catch (e) {

                        MessageBox.error(
                            `Unable to send Purchase Order ${po} for approval.\n\n${e.message}`
                        );

                    } finally {

                        m.setProperty(
                            "/submitting",
                            false
                        );
                    }
                },


            // =========================================================
            // CANCEL
            // =========================================================

            onCancel: function () {

                this.getOwnerComponent()
                    .getRouter()
                    .navTo(
                        "poList"
                    );
            }

        }
    );
});