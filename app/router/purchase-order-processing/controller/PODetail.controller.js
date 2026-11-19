sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "purchaseorderprocessing/controller/api"
], function (
    Controller,
    JSONModel,
    MessageBox,
    MessageToast,
    api
) {
    "use strict";

    return Controller.extend(
        "purchaseorderprocessing.controller.PODetail",
        {

            // ============================================================
            // INITIALIZATION
            // ============================================================

            onInit: function () {
                this.getOwnerComponent()
                    .getRouter()
                    .getRoute("poDetail")
                    .attachPatternMatched(
                        this._load,
                        this
                    );
            },


            // ============================================================
            // LOAD PURCHASE ORDER
            // ============================================================

            _load: async function (e) {

                const po =
                    e.getParameter(
                        "arguments"
                    ).poNumber;

                try {

                    const [
                        poRes,
                        itemRes,
                        supplierRes,
                        approvalRes,
                        historyRes
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
                        ),

                        api.list(
                            "Suppliers"
                        ),

                        api.query(
                            "Approvals",
                            `$filter=${encodeURIComponent(
                                `poNumber eq '${po}'`
                            )}`
                        ),

                        api.query(
                            "PurchaseOrderStatusHistory",
                            `$filter=${encodeURIComponent(
                                `poNumber eq '${po}'`
                            )}&$orderby=changedAt desc`
                        )

                    ]);

                    const o = poRes;


                    // ====================================================
                    // SUPPLIER
                    // ====================================================

                    const s =
                        (
                            supplierRes.value ||
                            []
                        ).find(
                            x =>
                                x.ID ===
                                o.supplier_ID
                        ) || {};


                    // ====================================================
                    // ITEMS
                    // ====================================================

                    const items =
                        itemRes.value || [];


                    const net =
                        items.reduce(
                            (
                                sum,
                                i
                            ) =>
                                sum +
                                Number(
                                    i.netValue ||
                                    0
                                ),
                            0
                        );


                    // ====================================================
                    // ACTIVITY HISTORY
                    // ====================================================

                    let history =
                        (
                            historyRes.value ||
                            []
                        ).map(
                            item => {

                                return {
                                    ...item,

                                    normalizedAction:
                                        this.normalizeActivityAction(
                                            item.action,
                                            item.fromStatus,
                                            item.toStatus
                                        ),

                                    displayChangedBy:
                                        this.getActivityUser(
                                            item,
                                            o
                                        )
                                };
                            }
                        );


                    history.sort(
                        (a, b) =>
                            new Date(
                                b.changedAt
                            ) -
                            new Date(
                                a.changedAt
                            )
                    );


                    // ====================================================
                    // CREATED ACTIVITY
                    // ====================================================

                    const hasCreatedActivity =
                        history.some(
                            item =>
                                item.normalizedAction ===
                                "createPurchaseOrder"
                        );


                    if (
                        !hasCreatedActivity &&
                        (
                            o.createdAt ||
                            o.documentDate
                        )
                    ) {

                        history.push({

                            historyId:
                                `CREATED-${po}`,

                            poNumber:
                                po,

                            fromStatus:
                                "",

                            toStatus:
                                "Draft",

                            action:
                                "createPurchaseOrder",

                            normalizedAction:
                                "createPurchaseOrder",

                            changedBy:
                                o.createdBy ||
                                "Unknown user",

                            displayChangedBy:
                                o.createdBy ||
                                "Unknown user",

                            changedAt:
                                o.createdAt ||
                                o.documentDate,

                            comment:
                                ""
                        });


                        history.sort(
                            (a, b) =>
                                new Date(
                                    b.changedAt
                                ) -
                                new Date(
                                    a.changedAt
                                )
                        );
                    }


                    // ====================================================
                    // DETAIL MODEL
                    // ====================================================

                    this.getView().setModel(
                        new JSONModel({

                            ...o,


                            // =================================================
                            // SUPPLIER
                            // =================================================

                            supplierName:
                                s.name ||
                                o.supplier_ID,

                            supplierId:
                                s.ID ||
                                o.supplier_ID,

                            supplierAddress:
                                s.address ||
                                s.city ||
                                "",

                            supplierContact:
                                s.contact ||
                                "",

                            supplierEmail:
                                s.email ||
                                "",

                            supplierPhone:
                                s.phone ||
                                "",


                            // =================================================
                            // ITEMS
                            // =================================================

                            items:
                                items.map(
                                    (
                                        i,
                                        n
                                    ) => ({

                                        ...i,

                                        itemNo:
                                            String(
                                                (n + 1) * 10
                                            )

                                    })
                                ),


                            // =================================================
                            // APPROVALS
                            // =================================================

                            approvals:
                                approvalRes.value ||
                                [],


                            // =================================================
                            // ACTIVITY
                            // =================================================

                            activity:
                                history,


                            // =================================================
                            // TOTALS
                            // =================================================

                            netValueDisplay:
                                `₹ ${net.toLocaleString(
                                    "en-IN",
                                    {
                                        minimumFractionDigits: 2
                                    }
                                )}`,

                            taxDisplay:
                                `₹ ${(net * 0.18).toLocaleString(
                                    "en-IN",
                                    {
                                        minimumFractionDigits: 2
                                    }
                                )}`,

                            totalDisplay:
                                `₹ ${(net * 1.18).toLocaleString(
                                    "en-IN",
                                    {
                                        minimumFractionDigits: 2
                                    }
                                )}`

                        }),
                        "detail"
                    );


                } catch (err) {

                    MessageBox.error(
                        `Unable to load Purchase Order ${po}.\n\n${err.message}`
                    );

                    console.error(
                        err
                    );
                }
            },


            // ============================================================
            // STATUS FORMATTER
            // ============================================================

            statusState: function (s) {

                return (
                    s === "Released" ||
                    s === "Approved" ||
                    s === "Fully Received"
                )
                    ? "Success"

                    : s === "Pending Approval" ||
                      s === "Submitted" ||
                      s === "Partially Received"
                    ? "Warning"

                    : s === "Blocked" ||
                      s === "Rejected" ||
                      s === "Cancelled"
                    ? "Error"

                    : "None";
            },


            // ============================================================
            // ITEM STATUS FORMATTER
            // ============================================================

            itemState: function (s) {

                return s === "Open"
                    ? "Success"

                    : s === "Blocked"
                    ? "Error"

                    : s === "Cancelled"
                    ? "None"

                    : "Warning";
            },


            // ============================================================
            // NORMALIZE ACTIVITY ACTION
            // ============================================================

            normalizeActivityAction: function (
                action,
                fromStatus,
                toStatus
            ) {

                const value =
                    String(
                        action || ""
                    ).trim();


                const lower =
                    value.toLowerCase();


                if (
                    lower === "createpurchaseorder" ||
                    lower === "create purchase order" ||
                    lower === "created"
                ) {

                    return "createPurchaseOrder";
                }


                if (
                    lower === "submitpurchaseorder" ||
                    lower === "submit" ||
                    lower === "submitted"
                ) {

                    return "submitPurchaseOrder";
                }


                if (
                    lower === "sendforapproval" ||
                    lower === "sentforapproval" ||
                    lower === "pendingapproval"
                ) {

                    return "sendForApproval";
                }


                if (
                    lower === "approvepurchaseorder" ||
                    lower === "approve" ||
                    lower === "approved"
                ) {

                    return "approvePurchaseOrder";
                }


                if (
                    lower === "rejectpurchaseorder" ||
                    lower === "reject" ||
                    lower === "rejected"
                ) {

                    return "rejectPurchaseOrder";
                }


                if (
                    lower === "releasepurchaseorder" ||
                    lower === "release" ||
                    lower === "released"
                ) {

                    return "releasePurchaseOrder";
                }


                if (
                    lower === "postgoodsreceipt" ||
                    lower === "goodsreceipt" ||
                    lower === "goodsreceiptposted"
                ) {

                    return "postGoodsReceipt";
                }


                if (
                    lower === "cancelpurchaseorder" ||
                    lower === "cancel" ||
                    lower === "cancelled"
                ) {

                    return "cancelPurchaseOrder";
                }


                if (
                    lower === "closepurchaseorder" ||
                    lower === "close" ||
                    lower === "closed"
                ) {

                    return "closePurchaseOrder";
                }


                // Fallback from target status

                if (
                    toStatus === "Submitted"
                ) {

                    return "submitPurchaseOrder";
                }


                if (
                    toStatus === "Pending Approval"
                ) {

                    return "sendForApproval";
                }


                if (
                    toStatus === "Approved"
                ) {

                    return "approvePurchaseOrder";
                }


                if (
                    toStatus === "Rejected"
                ) {

                    return "rejectPurchaseOrder";
                }


                if (
                    toStatus === "Released"
                ) {

                    return "releasePurchaseOrder";
                }


                if (
                    toStatus === "Partially Received" ||
                    toStatus === "Fully Received"
                ) {

                    return "postGoodsReceipt";
                }


                if (
                    toStatus === "Cancelled"
                ) {

                    return "cancelPurchaseOrder";
                }


                if (
                    toStatus === "Closed"
                ) {

                    return "closePurchaseOrder";
                }


                return value || "activity";
            },


            // ============================================================
            // ACTIVITY USER
            // ============================================================

            getActivityUser: function (
                item,
                purchaseOrder
            ) {

                const storedUser =
                    String(
                        item.changedBy || ""
                    ).trim();


                const action =
                    this.normalizeActivityAction(
                        item.action,
                        item.fromStatus,
                        item.toStatus
                    );


                if (
                    storedUser &&
                    storedUser.toLowerCase() !==
                        "anonymous" &&
                    storedUser.toLowerCase() !==
                        "unknown"
                ) {

                    return storedUser;
                }


                if (
                    action === "createPurchaseOrder" ||
                    action === "submitPurchaseOrder" ||
                    action === "sendForApproval"
                ) {

                    return (
                        purchaseOrder.createdBy ||
                        "Unknown user"
                    );
                }


                if (
                    action === "approvePurchaseOrder" ||
                    action === "rejectPurchaseOrder"
                ) {

                    return "Procurement Manager";
                }


                if (
                    action === "releasePurchaseOrder"
                ) {

                    return "Procurement System";
                }


                if (
                    action === "postGoodsReceipt"
                ) {

                    return (
                        purchaseOrder.createdBy ||
                        "Unknown user"
                    );
                }


                if (
                    action === "cancelPurchaseOrder"
                ) {

                    return (
                        purchaseOrder.createdBy ||
                        "Unknown user"
                    );
                }


                if (
                    action === "closePurchaseOrder"
                ) {

                    return (
                        purchaseOrder.createdBy ||
                        "Unknown user"
                    );
                }


                return (
                    purchaseOrder.createdBy ||
                    "Unknown user"
                );
            },


            // ============================================================
            // ACTIVITY TITLE
            // ============================================================

            activityTitle: function (
                action,
                fromStatus,
                toStatus
            ) {

                const normalized =
                    this.normalizeActivityAction(
                        action,
                        fromStatus,
                        toStatus
                    );


                const map = {

                    createPurchaseOrder:
                        "PO created",

                    submitPurchaseOrder:
                        "Submitted for approval",

                    sendForApproval:
                        "Sent for approval",

                    approvePurchaseOrder:
                        "Approved",

                    rejectPurchaseOrder:
                        "Rejected",

                    releasePurchaseOrder:
                        "PO released",

                    postGoodsReceipt:
                        "Goods receipt posted",

                    cancelPurchaseOrder:
                        "PO cancelled",

                    closePurchaseOrder:
                        "PO closed"

                };


                if (
                    map[normalized]
                ) {

                    return map[normalized];
                }


                if (
                    toStatus === "Draft"
                ) {

                    return "PO created";
                }


                if (
                    toStatus === "Submitted"
                ) {

                    return "Submitted for approval";
                }


                if (
                    toStatus === "Pending Approval"
                ) {

                    return "Sent for approval";
                }


                if (
                    toStatus === "Approved"
                ) {

                    return "Approved";
                }


                if (
                    toStatus === "Rejected"
                ) {

                    return "Rejected";
                }


                if (
                    toStatus === "Released"
                ) {

                    return "PO released";
                }


                if (
                    toStatus === "Partially Received"
                ) {

                    return "Partially received";
                }


                if (
                    toStatus === "Fully Received"
                ) {

                    return "Fully received";
                }


                if (
                    toStatus === "Cancelled"
                ) {

                    return "PO cancelled";
                }


                if (
                    toStatus === "Closed"
                ) {

                    return "PO closed";
                }


                return "Activity";
            },


            // ============================================================
            // ACTIVITY DATE
            // ============================================================

            formatActivityDate: function (
                value
            ) {

                if (!value) {
                    return "";
                }


                const date =
                    new Date(value);


                if (
                    Number.isNaN(
                        date.getTime()
                    )
                ) {

                    return value;
                }


                return date.toLocaleString(
                    "en-IN",
                    {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true
                    }
                );
            },


            // ============================================================
            // ACTIVITY ICON
            // ============================================================

            activityIcon: function (
                action,
                toStatus
            ) {

                const normalized =
                    this.normalizeActivityAction(
                        action,
                        "",
                        toStatus
                    );


                if (
                    normalized ===
                    "createPurchaseOrder"
                ) {

                    return "sap-icon://add-document";
                }


                if (
                    normalized ===
                    "approvePurchaseOrder"
                ) {

                    return "sap-icon://accept";
                }


                if (
                    normalized ===
                    "rejectPurchaseOrder"
                ) {

                    return "sap-icon://decline";
                }


                if (
                    normalized ===
                    "releasePurchaseOrder"
                ) {

                    return "sap-icon://complete";
                }


                if (
                    normalized ===
                    "postGoodsReceipt"
                ) {

                    return "sap-icon://shipping-status";
                }


                if (
                    normalized ===
                    "cancelPurchaseOrder"
                ) {

                    return "sap-icon://sys-cancel";
                }


                if (
                    normalized ===
                    "closePurchaseOrder"
                ) {

                    return "sap-icon://locked";
                }


                if (
                    normalized ===
                    "sendForApproval"
                ) {

                    return "sap-icon://approvals";
                }


                if (
                    normalized ===
                    "submitPurchaseOrder"
                ) {

                    return "sap-icon://paper-plane";
                }


                if (
                    toStatus ===
                    "Pending Approval"
                ) {

                    return "sap-icon://approvals";
                }


                if (
                    toStatus ===
                    "Submitted"
                ) {

                    return "sap-icon://paper-plane";
                }


                return "sap-icon://history";
            },


            // ============================================================
            // ACTIVITY STATE
            // ============================================================

            activityState: function (
                toStatus
            ) {

                if (
                    toStatus === "Approved" ||
                    toStatus === "Released" ||
                    toStatus === "Fully Received" ||
                    toStatus === "Closed"
                ) {

                    return "Success";
                }


                if (
                    toStatus === "Rejected" ||
                    toStatus === "Cancelled"
                ) {

                    return "Error";
                }


                if (
                    toStatus === "Submitted" ||
                    toStatus === "Pending Approval" ||
                    toStatus === "Partially Received"
                ) {

                    return "Warning";
                }


                return "None";
            },


            // ============================================================
            // APPROVAL ICON
            // ============================================================

            approvalIcon: function (
                status
            ) {

                if (
                    status === "Approved"
                ) {

                    return "sap-icon://accept";
                }


                if (
                    status === "Rejected"
                ) {

                    return "sap-icon://decline";
                }


                if (
                    status === "Pending"
                ) {

                    return "sap-icon://pending";
                }


                return "sap-icon://history";
            },


            // ============================================================
            // BACK
            // ============================================================

            onBack: function () {

                this.getOwnerComponent()
                    .getRouter()
                    .navTo(
                        "poList"
                    );
            },


            // ============================================================
            // EDIT
            // ============================================================

            onEdit: function () {

                const po =
                    this.getView()
                        .getModel("detail")
                        .getProperty(
                            "/poNumber"
                        );


                this.getOwnerComponent()
                    .getRouter()
                    .navTo(
                        "editPO",
                        {
                            poNumber:
                                po
                        }
                    );
            },


            // ============================================================
            // COPY PURCHASE ORDER
            // ============================================================

            onCopy: function () {

                const po =
                    this.getView()
                        .getModel("detail")
                        .getProperty(
                            "/poNumber"
                        );


                MessageBox.information(
                    `Copy Purchase Order ${po} is ready for implementation as a new Draft Purchase Order.`
                );
            },


            // ============================================================
            // PRINT PURCHASE ORDER
            // ============================================================

            onPrint: function () {

                try {

                    const model =
                        this.getView()
                            .getModel("detail");

                    if (!model) {
                        MessageBox.error(
                            "Purchase Order information is not available."
                        );
                        return;
                    }


                    const data =
                        model.getData();


                    if (!data || !data.poNumber) {
                        MessageBox.error(
                            "Unable to prepare Purchase Order for printing."
                        );
                        return;
                    }


                    // ----------------------------------------------------
                    // HTML ESCAPE
                    // ----------------------------------------------------

                    const escapeHtml =
                        function (value) {

                            if (
                                value === null ||
                                value === undefined
                            ) {
                                return "";
                            }

                            return String(value)
                                .replace(
                                    /&/g,
                                    "&amp;"
                                )
                                .replace(
                                    /</g,
                                    "&lt;"
                                )
                                .replace(
                                    />/g,
                                    "&gt;"
                                )
                                .replace(
                                    /"/g,
                                    "&quot;"
                                )
                                .replace(
                                    /'/g,
                                    "&#039;"
                                );
                        };


                    // ----------------------------------------------------
                    // DATE FORMAT
                    // ----------------------------------------------------

                    const formatDate =
                        function (value) {

                            if (!value) {
                                return "";
                            }

                            const date =
                                new Date(value);

                            if (
                                Number.isNaN(
                                    date.getTime()
                                )
                            ) {
                                return escapeHtml(
                                    value
                                );
                            }

                            return date.toLocaleDateString(
                                "en-IN",
                                {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric"
                                }
                            );
                        };


                    // ----------------------------------------------------
                    // CURRENCY
                    // ----------------------------------------------------

                    const formatCurrency =
                        function (
                            value,
                            currency
                        ) {

                            const amount =
                                Number(
                                    value || 0
                                );

                            const curr =
                                currency ||
                                "INR";

                            try {

                                return new Intl.NumberFormat(
                                    "en-IN",
                                    {
                                        style: "currency",
                                        currency: curr,
                                        minimumFractionDigits: 2
                                    }
                                ).format(
                                    amount
                                );

                            } catch (e) {

                                return `${curr} ${amount.toFixed(
                                    2
                                )}`;
                            }
                        };


                    // ----------------------------------------------------
                    // BASIC VALUES
                    // ----------------------------------------------------

                    const poNumber =
                        escapeHtml(
                            data.poNumber
                        );

                    const supplierName =
                        escapeHtml(
                            data.supplierName ||
                            data.supplier_ID ||
                            ""
                        );

                    const supplierId =
                        escapeHtml(
                            data.supplierId ||
                            data.supplier_ID ||
                            ""
                        );

                    const companyCode =
                        escapeHtml(
                            data.companyCode ||
                            ""
                        );

                    const purchasingOrg =
                        escapeHtml(
                            data.purchasingOrg ||
                            ""
                        );

                    const purchasingGroup =
                        escapeHtml(
                            data.purchasingGroup ||
                            ""
                        );

                    const currency =
                        escapeHtml(
                            data.currency ||
                            "INR"
                        );

                    const status =
                        escapeHtml(
                            data.status ||
                            ""
                        );

                    const approvalStatus =
                        escapeHtml(
                            data.approvalStatus ||
                            ""
                        );

                    const createdBy =
                        escapeHtml(
                            data.createdBy ||
                            ""
                        );

                    const paymentTerms =
                        escapeHtml(
                            data.paymentTerms ||
                            ""
                        );

                    const incoterms =
                        escapeHtml(
                            data.incoterms ||
                            ""
                        );

                    const reference =
                        escapeHtml(
                            data.reference ||
                            ""
                        );

                    const note =
                        escapeHtml(
                            data.note ||
                            ""
                        );

                    const supplierAddress =
                        escapeHtml(
                            data.supplierAddress ||
                            ""
                        );

                    const supplierContact =
                        escapeHtml(
                            data.supplierContact ||
                            ""
                        );

                    const supplierEmail =
                        escapeHtml(
                            data.supplierEmail ||
                            ""
                        );

                    const supplierPhone =
                        escapeHtml(
                            data.supplierPhone ||
                            ""
                        );


                    // ----------------------------------------------------
                    // ITEM ROWS
                    // ----------------------------------------------------

                    const itemRows =
                        (data.items || [])
                            .map(
                                function (item, index) {

                                    const itemNo =
                                        escapeHtml(
                                            item.itemNo ||
                                            String(
                                                (index + 1) *
                                                10
                                            )
                                        );

                                    const material =
                                        escapeHtml(
                                            item.material ||
                                            ""
                                        );

                                    const description =
                                        escapeHtml(
                                            item.description ||
                                            ""
                                        );

                                    const quantity =
                                        Number(
                                            item.quantity ||
                                            0
                                        );

                                    const unit =
                                        escapeHtml(
                                            item.unit ||
                                            ""
                                        );

                                    const unitPrice =
                                        formatCurrency(
                                            item.unitPrice,
                                            data.currency
                                        );

                                    const total =
                                        formatCurrency(
                                            item.netValue,
                                            data.currency
                                        );

                                    const itemStatus =
                                        escapeHtml(
                                            item.status ||
                                            ""
                                        );

                                    return `
                                        <tr>
                                            <td>${itemNo}</td>
                                            <td>
                                                <strong>${material}</strong>
                                                ${
                                                    description
                                                        ? `<div class="description">${description}</div>`
                                                        : ""
                                                }
                                            </td>
                                            <td class="number">
                                                ${quantity.toLocaleString(
                                                    "en-IN",
                                                    {
                                                        maximumFractionDigits: 3
                                                    }
                                                )}
                                                ${unit}
                                            </td>
                                            <td class="number">
                                                ${unitPrice}
                                            </td>
                                            <td class="number">
                                                ${total}
                                            </td>
                                            <td>
                                                ${itemStatus}
                                            </td>
                                        </tr>
                                    `;
                                }
                            )
                            .join("");


                    // ----------------------------------------------------
                    // APPROVAL ROWS
                    // ----------------------------------------------------

                    const approvalRows =
                        (data.approvals || [])
                            .map(
                                function (approval) {

                                    return `
                                        <tr>
                                            <td>
                                                ${escapeHtml(
                                                    approval.approver ||
                                                    ""
                                                )}
                                            </td>
                                            <td>
                                                ${escapeHtml(
                                                    approval.status ||
                                                    ""
                                                )}
                                            </td>
                                            <td>
                                                ${formatDate(
                                                    approval.createdOn
                                                )}
                                            </td>
                                            <td>
                                                ${escapeHtml(
                                                    approval.comments ||
                                                    ""
                                                )}
                                            </td>
                                        </tr>
                                    `;
                                }
                            )
                            .join("");


                    // ----------------------------------------------------
                    // FINANCIAL VALUES
                    // ----------------------------------------------------

                    const netValue =
                        Number(
                            (data.items || [])
                                .reduce(
                                    function (
                                        sum,
                                        item
                                    ) {
                                        return (
                                            sum +
                                            Number(
                                                item.netValue ||
                                                0
                                            )
                                        );
                                    },
                                    0
                                )
                        );

                    const tax =
                        netValue * 0.18;

                    const totalValue =
                        netValue + tax;


                    // ----------------------------------------------------
                    // CREATE PRINT DOCUMENT
                    // ----------------------------------------------------

                    const printWindow =
                        window.open(
                            "",
                            "_blank",
                            "width=1000,height=800"
                        );


                    if (!printWindow) {

                        MessageBox.error(
                            "The print window was blocked by the browser. Please allow pop-ups for this application."
                        );

                        return;
                    }


                    printWindow.document.open();

                    printWindow.document.write(
                        `
                        <!DOCTYPE html>

                        <html>

                        <head>

                            <meta charset="UTF-8">

                            <title>
                                Purchase Order ${poNumber}
                            </title>

                            <style>

                                @page {
                                    size: A4;
                                    margin: 14mm;
                                }

                                * {
                                    box-sizing: border-box;
                                }

                                body {
                                    margin: 0;
                                    padding: 0;
                                    font-family:
                                        Arial,
                                        Helvetica,
                                        sans-serif;
                                    font-size: 11px;
                                    color: #222;
                                    background: #fff;
                                }

                                .document {
                                    width: 100%;
                                    max-width: 190mm;
                                    margin: 0 auto;
                                }

                                .header {
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: flex-start;
                                    border-bottom: 2px solid #1f4e79;
                                    padding-bottom: 10px;
                                    margin-bottom: 14px;
                                }

                                .company-title {
                                    font-size: 20px;
                                    font-weight: bold;
                                    color: #1f4e79;
                                }

                                .document-title {
                                    text-align: right;
                                }

                                .document-title h1 {
                                    margin: 0;
                                    font-size: 18px;
                                    color: #1f4e79;
                                }

                                .document-title .po-number {
                                    margin-top: 4px;
                                    font-size: 13px;
                                    font-weight: bold;
                                }

                                .section {
                                    margin-top: 14px;
                                    page-break-inside: avoid;
                                }

                                .section-title {
                                    background: #f1f4f7;
                                    border-left: 4px solid #1f4e79;
                                    padding: 7px 9px;
                                    font-size: 12px;
                                    font-weight: bold;
                                    color: #1f4e79;
                                    margin-bottom: 8px;
                                }

                                .details-grid {
                                    display: grid;
                                    grid-template-columns:
                                        1fr 1fr;
                                    column-gap: 35px;
                                    row-gap: 6px;
                                }

                                .detail-row {
                                    display: grid;
                                    grid-template-columns:
                                        130px 1fr;
                                }

                                .label {
                                    color: #666;
                                    font-weight: normal;
                                }

                                .value {
                                    font-weight: 600;
                                }

                                .supplier-box {
                                    border: 1px solid #d5dadd;
                                    padding: 10px;
                                    border-radius: 3px;
                                }

                                .supplier-name {
                                    font-size: 14px;
                                    font-weight: bold;
                                    margin-bottom: 5px;
                                }

                                table {
                                    width: 100%;
                                    border-collapse: collapse;
                                    margin-top: 5px;
                                }

                                th {
                                    background: #f1f4f7;
                                    color: #333;
                                    font-weight: bold;
                                    border: 1px solid #cfd5da;
                                    padding: 7px 6px;
                                    text-align: left;
                                }

                                td {
                                    border: 1px solid #d9dee2;
                                    padding: 7px 6px;
                                    vertical-align: top;
                                }

                                .number {
                                    text-align: right;
                                    white-space: nowrap;
                                }

                                .description {
                                    margin-top: 3px;
                                    color: #666;
                                    font-size: 10px;
                                }

                                .financial {
                                    width: 310px;
                                    margin-left: auto;
                                    margin-top: 10px;
                                }

                                .financial-row {
                                    display: flex;
                                    justify-content: space-between;
                                    padding: 4px 0;
                                }

                                .financial-total {
                                    border-top: 2px solid #333;
                                    margin-top: 4px;
                                    padding-top: 7px;
                                    font-size: 13px;
                                    font-weight: bold;
                                }

                                .status {
                                    display: inline-block;
                                    padding: 4px 9px;
                                    border: 1px solid #999;
                                    border-radius: 12px;
                                    font-weight: bold;
                                }

                                .notes {
                                    border: 1px solid #d5dadd;
                                    padding: 10px;
                                    min-height: 40px;
                                    white-space: pre-wrap;
                                }

                                .footer {
                                    margin-top: 20px;
                                    padding-top: 8px;
                                    border-top: 1px solid #ccc;
                                    display: flex;
                                    justify-content: space-between;
                                    color: #777;
                                    font-size: 9px;
                                }

                                .empty {
                                    color: #777;
                                    font-style: italic;
                                    padding: 8px 0;
                                }

                                @media print {

                                    body {
                                        background: white;
                                    }

                                    .document {
                                        max-width: none;
                                    }

                                    .no-print {
                                        display: none !important;
                                    }

                                    table {
                                        page-break-inside: auto;
                                    }

                                    tr {
                                        page-break-inside: avoid;
                                        page-break-after: auto;
                                    }

                                }

                            </style>

                        </head>

                        <body>

                            <div class="document">

                                <!-- HEADER -->

                                <div class="header">

                                    <div>

                                        <div class="company-title">
                                            Purchase Order Processing
                                        </div>

                                        <div>
                                            Purchase Order Document
                                        </div>

                                    </div>

                                    <div class="document-title">

                                        <h1>
                                            PURCHASE ORDER
                                        </h1>

                                        <div class="po-number">
                                            ${poNumber}
                                        </div>

                                    </div>

                                </div>


                                <!-- GENERAL INFORMATION -->

                                <div class="section">

                                    <div class="section-title">
                                        Purchase Order Information
                                    </div>

                                    <div class="details-grid">

                                        <div class="detail-row">
                                            <div class="label">
                                                PO Number
                                            </div>
                                            <div class="value">
                                                ${poNumber}
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Status
                                            </div>
                                            <div class="value">
                                                <span class="status">
                                                    ${status}
                                                </span>
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Supplier
                                            </div>
                                            <div class="value">
                                                ${supplierName}
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Supplier ID
                                            </div>
                                            <div class="value">
                                                ${supplierId}
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Company Code
                                            </div>
                                            <div class="value">
                                                ${companyCode}
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Purchasing Organization
                                            </div>
                                            <div class="value">
                                                ${purchasingOrg}
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Purchasing Group
                                            </div>
                                            <div class="value">
                                                ${purchasingGroup}
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Currency
                                            </div>
                                            <div class="value">
                                                ${currency}
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Document Date
                                            </div>
                                            <div class="value">
                                                ${formatDate(
                                                    data.documentDate
                                                )}
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Delivery Date
                                            </div>
                                            <div class="value">
                                                ${formatDate(
                                                    data.deliveryDate
                                                )}
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Created By
                                            </div>
                                            <div class="value">
                                                ${createdBy}
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Created On
                                            </div>
                                            <div class="value">
                                                ${formatDate(
                                                    data.createdAt
                                                )}
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Payment Terms
                                            </div>
                                            <div class="value">
                                                ${paymentTerms}
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Incoterms
                                            </div>
                                            <div class="value">
                                                ${incoterms}
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Reference
                                            </div>
                                            <div class="value">
                                                ${reference}
                                            </div>
                                        </div>

                                        <div class="detail-row">
                                            <div class="label">
                                                Approval Status
                                            </div>
                                            <div class="value">
                                                ${approvalStatus}
                                            </div>
                                        </div>

                                    </div>

                                </div>


                                <!-- SUPPLIER INFORMATION -->

                                <div class="section">

                                    <div class="section-title">
                                        Supplier Information
                                    </div>

                                    <div class="supplier-box">

                                        <div class="supplier-name">
                                            ${supplierName}
                                        </div>

                                        ${
                                            supplierId
                                                ? `<div>
                                                    Supplier ID:
                                                    ${supplierId}
                                                   </div>`
                                                : ""
                                        }

                                        ${
                                            supplierAddress
                                                ? `<div>
                                                    ${supplierAddress}
                                                   </div>`
                                                : ""
                                        }

                                        ${
                                            supplierContact
                                                ? `<div>
                                                    Contact:
                                                    ${supplierContact}
                                                   </div>`
                                                : ""
                                        }

                                        ${
                                            supplierEmail
                                                ? `<div>
                                                    Email:
                                                    ${supplierEmail}
                                                   </div>`
                                                : ""
                                        }

                                        ${
                                            supplierPhone
                                                ? `<div>
                                                    Phone:
                                                    ${supplierPhone}
                                                   </div>`
                                                : ""
                                        }

                                    </div>

                                </div>


                                <!-- ITEMS -->

                                <div class="section">

                                    <div class="section-title">
                                        Purchase Order Items
                                    </div>

                                    ${
                                        itemRows
                                            ? `
                                                <table>

                                                    <thead>

                                                        <tr>

                                                            <th style="width:8%">
                                                                Item
                                                            </th>

                                                            <th style="width:30%">
                                                                Material / Description
                                                            </th>

                                                            <th style="width:14%">
                                                                Quantity
                                                            </th>

                                                            <th style="width:16%">
                                                                Unit Price
                                                            </th>

                                                            <th style="width:18%">
                                                                Net Value
                                                            </th>

                                                            <th style="width:14%">
                                                                Status
                                                            </th>

                                                        </tr>

                                                    </thead>

                                                    <tbody>

                                                        ${itemRows}

                                                    </tbody>

                                                </table>
                                            `
                                            : `
                                                <div class="empty">
                                                    No items available.
                                                </div>
                                            `
                                    }

                                </div>


                                <!-- FINANCIAL SUMMARY -->

                                <div class="section">

                                    <div class="section-title">
                                        Financial Summary
                                    </div>

                                    <div class="financial">

                                        <div class="financial-row">

                                            <span>
                                                Net Value
                                            </span>

                                            <strong>
                                                ${formatCurrency(
                                                    netValue,
                                                    data.currency
                                                )}
                                            </strong>

                                        </div>

                                        <div class="financial-row">

                                            <span>
                                                GST (18%)
                                            </span>

                                            <strong>
                                                ${formatCurrency(
                                                    tax,
                                                    data.currency
                                                )}
                                            </strong>

                                        </div>

                                        <div class="financial-row financial-total">

                                            <span>
                                                Total Value
                                            </span>

                                            <strong>
                                                ${formatCurrency(
                                                    totalValue,
                                                    data.currency
                                                )}
                                            </strong>

                                        </div>

                                    </div>

                                </div>


                                <!-- APPROVAL INFORMATION -->

                                ${
                                    approvalRows
                                        ? `
                                            <div class="section">

                                                <div class="section-title">
                                                    Approval Information
                                                </div>

                                                <table>

                                                    <thead>

                                                        <tr>

                                                            <th>
                                                                Approver
                                                            </th>

                                                            <th>
                                                                Status
                                                            </th>

                                                            <th>
                                                                Date
                                                            </th>

                                                            <th>
                                                                Comments
                                                            </th>

                                                        </tr>

                                                    </thead>

                                                    <tbody>

                                                        ${approvalRows}

                                                    </tbody>

                                                </table>

                                            </div>
                                        `
                                        : ""
                                }


                                <!-- NOTES -->

                                ${
                                    note
                                        ? `
                                            <div class="section">

                                                <div class="section-title">
                                                    Notes
                                                </div>

                                                <div class="notes">
                                                    ${note}
                                                </div>

                                            </div>
                                        `
                                        : ""
                                }


                                <!-- FOOTER -->

                                <div class="footer">

                                    <span>
                                        Purchase Order ${poNumber}
                                    </span>

                                    <span>
                                        Printed on
                                        ${new Date().toLocaleString(
                                            "en-IN"
                                        )}
                                    </span>

                                </div>

                            </div>

                        </body>

                        </html>
                        `
                    );

                    printWindow.document.close();


                    // ----------------------------------------------------
                    // WAIT FOR DOCUMENT TO RENDER
                    // ----------------------------------------------------

                    printWindow.onload =
                        function () {

                            setTimeout(
                                function () {

                                    printWindow.focus();

                                    printWindow.print();

                                },
                                300
                            );
                        };


                } catch (e) {

                    console.error(
                        "Print error:",
                        e
                    );

                    MessageBox.error(
                        "Unable to prepare the Purchase Order for printing."
                    );
                }
            },


            // ============================================================
            // RELEASE PURCHASE ORDER
            // ============================================================

            onRelease: function () {

                const po =
                    this.getView()
                        .getModel("detail")
                        .getProperty(
                            "/poNumber"
                        );


                MessageBox.confirm(
                    `Release Purchase Order ${po}?`,
                    {

                        title:
                            "Release Purchase Order",

                        actions: [
                            MessageBox.Action.OK,
                            MessageBox.Action.CANCEL
                        ],

                        emphasizedAction:
                            MessageBox.Action.OK,

                        onClose:
                            async function (
                                action
                            ) {

                                if (
                                    action !==
                                    MessageBox.Action.OK
                                ) {

                                    return;
                                }


                                try {

                                    await api.action(
                                        "releasePurchaseOrder",
                                        {
                                            poNumber:
                                                po
                                        }
                                    );


                                    MessageToast.show(
                                        `Purchase Order ${po} released successfully.`
                                    );


                                    await this._load({
                                        getParameter:
                                            function () {

                                                return {
                                                    poNumber:
                                                        po
                                                };
                                            }
                                    });


                                } catch (e) {

                                    MessageBox.error(
                                        e.message ||
                                        "Unable to release Purchase Order."
                                    );
                                }

                            }.bind(this)
                    }
                );
            },


            // ============================================================
            // GOODS RECEIPT
            // ============================================================

            onGoodsReceipt: function () {

                const po =
                    this.getView()
                        .getModel("detail")
                        .getProperty(
                            "/poNumber"
                        );


                this.getOwnerComponent()
                    .getRouter()
                    .navTo(
                        "goodsReceipt",
                        {
                            poNumber:
                                po
                        }
                    );
            },


            // ============================================================
            // APPROVAL ACTION
            // ============================================================

            _action: async function (
                name
            ) {

                const po =
                    this.getView()
                        .getModel("detail")
                        .getProperty(
                            "/poNumber"
                        );


                let actionName;
                let comment;
                let successText;


                // --------------------------------------------------------
                // APPROVE
                // --------------------------------------------------------

                if (
                    name === "approve"
                ) {

                    actionName =
                        "approvePurchaseOrder";

                    comment =
                        "Approved from Fiori";

                    successText =
                        "approved";
                }


                // --------------------------------------------------------
                // REJECT
                // --------------------------------------------------------

                else if (
                    name === "reject"
                ) {

                    actionName =
                        "rejectPurchaseOrder";

                    comment =
                        "Rejected from Fiori";

                    successText =
                        "rejected";
                }


                else {

                    actionName =
                        name;

                    comment =
                        "";

                    successText =
                        "processed";
                }


                try {

                    await api.action(
                        actionName,
                        {
                            poNumber:
                                po,

                            comment:
                                comment
                        }
                    );


                    MessageToast.show(
                        `Purchase Order ${po} ${successText}.`
                    );


                    await this._load({
                        getParameter:
                            () => ({
                                poNumber:
                                    po
                            })
                    });


                } catch (e) {

                    MessageBox.error(
                        e.message ||
                        "Action failed"
                    );
                }
            },


            // ============================================================
            // APPROVE
            // ============================================================

            onApprove: function () {

                this._action(
                    "approve"
                );
            },


            // ============================================================
            // REJECT
            // ============================================================

            onReject: function () {

                this._action(
                    "reject"
                );
            },


            // ============================================================
            // CANCEL PURCHASE ORDER
            // ============================================================

            onCancelPO: function () {

                const po =
                    this.getView()
                        .getModel("detail")
                        .getProperty(
                            "/poNumber"
                        );


                MessageBox.confirm(
                    `Cancel Purchase Order ${po}?`,
                    {

                        title:
                            "Cancel Purchase Order",

                        actions: [
                            MessageBox.Action.OK,
                            MessageBox.Action.CANCEL
                        ],

                        emphasizedAction:
                            MessageBox.Action.OK,

                        onClose:
                            async function (
                                action
                            ) {

                                if (
                                    action !==
                                    MessageBox.Action.OK
                                ) {

                                    return;
                                }


                                try {

                                    await api.action(
                                        "cancelPurchaseOrder",
                                        {
                                            poNumber:
                                                po,

                                            comment:
                                                "Cancelled from Fiori"
                                        }
                                    );


                                    MessageToast.show(
                                        "Purchase Order cancelled."
                                    );


                                    await this._load({
                                        getParameter:
                                            () => ({
                                                poNumber:
                                                    po
                                            })
                                    });


                                } catch (e) {

                                    MessageBox.error(
                                        e.message ||
                                        "Unable to cancel Purchase Order"
                                    );
                                }

                            }.bind(this)
                    }
                );
            }

        }
    );
});