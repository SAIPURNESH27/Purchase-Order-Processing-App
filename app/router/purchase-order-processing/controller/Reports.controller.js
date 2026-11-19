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
        "purchaseorderprocessing.controller.Reports",
        {

            /* =========================================================
               INITIALIZATION
               ========================================================= */

            onInit: function () {

                const today = new Date();

                const year = today.getFullYear();

                const fromDate =
                    `${year}-01-01`;

                const toDate =
                    this._formatDate(today);

                this.getView().setModel(
                    new JSONModel({

                        filters: {
                            fromDate: fromDate,
                            toDate: toDate,
                            supplier: "",
                            status: "",
                            companyCode: ""
                        },

                        suppliers: [],

                        year: String(year),

                        kpis: {
                            totalOrders: 0,
                            totalSpend: "0.00",
                            averagePO: "0.00",
                            pending: 0,
                            released: 0,
                            blocked: 0,
                            cancelled: 0,
                            supplierCount: 0
                        },

                        monthlySpend: this._emptyMonthlyData(),

                        statusData: [
                            {
                                status: "Released",
                                count: 0
                            },
                            {
                                status: "Pending",
                                count: 0
                            },
                            {
                                status: "Blocked",
                                count: 0
                            },
                            {
                                status: "Rejected",
                                count: 0
                            },
                            {
                                status: "Cancelled",
                                count: 0
                            }
                        ],

                        supplierSpend: [],

                        items: [],

                        countText: "0 purchase orders",

                        monthlySummary:
                            "Year-to-date net spend: ₹ 0.00",

                        lastUpdated: ""

                    }),
                    "reports"
                );

                this._load();
            },


            /* =========================================================
               FILTER PANEL TOGGLE
               ========================================================= */

            onToggleFilters: function (event) {

                const content =
                    this.byId("reportFilterContent");

                if (!content) {
                    return;
                }

                const isVisible =
                    content.getVisible();

                content.setVisible(!isVisible);

                const button =
                    event.getSource();

                if (isVisible) {

                    button.setIcon(
                        "sap-icon://slim-arrow-right"
                    );

                    button.setTooltip(
                        "Expand Filters"
                    );

                } else {

                    button.setIcon(
                        "sap-icon://slim-arrow-down"
                    );

                    button.setTooltip(
                        "Collapse Filters"
                    );
                }
            },


            /* =========================================================
               LOAD REPORT DATA
               ========================================================= */

            _load: async function () {

                try {

                    const [
                        poResponse,
                        itemResponse,
                        supplierResponse
                    ] = await Promise.all([

                        api.list("PurchaseOrders"),

                        api.list("PurchaseOrderItems"),

                        api.list("Suppliers")

                    ]);


                    const orders =
                        Array.isArray(poResponse?.value)
                            ? poResponse.value
                            : [];


                    const items =
                        Array.isArray(itemResponse?.value)
                            ? itemResponse.value
                            : [];


                    const suppliers =
                        Array.isArray(supplierResponse?.value)
                            ? supplierResponse.value
                            : [];


                    /* =================================================
                       STORE SUPPLIERS
                       ================================================= */

                    this.getView()
                        .getModel("reports")
                        .setProperty(
                            "/suppliers",
                            suppliers
                        );


                    /* =================================================
                       SUPPLIER LOOKUP
                       ================================================= */

                    const supplierMap = {};

                    suppliers.forEach(function (supplier) {

                        supplierMap[
                            String(supplier.ID)
                        ] = supplier.name || "";

                    });


                    /* =================================================
                       GROUP ITEMS BY PO
                       ================================================= */

                    const itemsByPO = {};

                    items.forEach(function (item) {

                        const poNumber =
                            String(item.poNumber || "");

                        if (!itemsByPO[poNumber]) {

                            itemsByPO[poNumber] = [];
                        }

                        itemsByPO[poNumber].push(item);

                    });


                    /* =================================================
                       CALCULATE PO NET VALUE
                       ================================================= */

                    const getPOValue = function (po) {

                        const poNumber =
                            String(po.poNumber || "");

                        const poItems =
                            itemsByPO[poNumber] || [];

                        return poItems.reduce(
                            function (sum, item) {

                                const quantity =
                                    Number(item.quantity) || 0;

                                const unitPrice =
                                    Number(item.unitPrice) || 0;

                                const value =
                                    Number(item.netValue);

                                if (Number.isFinite(value)) {

                                    return sum + value;
                                }

                                return (
                                    sum +
                                    quantity * unitPrice
                                );

                            },
                            0
                        );
                    };


                    /* =================================================
                       APPLY FILTERS
                       ================================================= */

                    const model =
                        this.getView()
                            .getModel("reports");

                    const filters =
                        model.getProperty("/filters") || {};


                    const fromDate =
                        filters.fromDate
                            ? new Date(
                                `${filters.fromDate}T00:00:00`
                            )
                            : null;


                    const toDate =
                        filters.toDate
                            ? new Date(
                                `${filters.toDate}T23:59:59`
                            )
                            : null;


                    const selectedSupplier =
                        String(
                            filters.supplier || ""
                        ).trim();


                    const selectedStatus =
                        String(
                            filters.status || ""
                        ).trim().toLowerCase();


                    const selectedCompanyCode =
                        String(
                            filters.companyCode || ""
                        ).trim();


                    const filteredOrders =
                        orders.filter(function (po) {

                            /* -----------------------------------------
                               DATE
                               ----------------------------------------- */

                            if (po.documentDate) {

                                const documentDate =
                                    new Date(
                                        `${String(
                                            po.documentDate
                                        ).slice(0, 10)}T00:00:00`
                                    );

                                if (
                                    fromDate &&
                                    documentDate < fromDate
                                ) {
                                    return false;
                                }

                                if (
                                    toDate &&
                                    documentDate > toDate
                                ) {
                                    return false;
                                }
                            }


                            /* -----------------------------------------
                               SUPPLIER
                               ----------------------------------------- */

                            if (
                                selectedSupplier &&
                                String(
                                    po.supplier_ID || ""
                                ) !== selectedSupplier
                            ) {
                                return false;
                            }


                            /* -----------------------------------------
                               STATUS
                               ----------------------------------------- */

                            if (
                                selectedStatus &&
                                String(
                                    po.status || ""
                                ).trim().toLowerCase() !==
                                selectedStatus
                            ) {
                                return false;
                            }


                            /* -----------------------------------------
                               COMPANY CODE
                               ----------------------------------------- */

                            if (
                                selectedCompanyCode &&
                                String(
                                    po.companyCode || ""
                                ).trim() !==
                                selectedCompanyCode
                            ) {
                                return false;
                            }


                            return true;

                        });


                    /* =================================================
                       KPI CALCULATIONS
                       ================================================= */

                    const totalOrders =
                        filteredOrders.length;


                    const totalSpend =
                        filteredOrders.reduce(
                            function (sum, po) {

                                return (
                                    sum +
                                    getPOValue(po)
                                );

                            },
                            0
                        );


                    const averagePO =
                        totalOrders > 0
                            ? totalSpend / totalOrders
                            : 0;


                    let pending = 0;
                    let released = 0;
                    let blocked = 0;
                    let cancelled = 0;


                    filteredOrders.forEach(
                        function (po) {

                            const status =
                                String(
                                    po.status || ""
                                )
                                    .trim()
                                    .toLowerCase();


                            switch (status) {

                                case "pending":
                                    pending++;
                                    break;

                                case "released":
                                    released++;
                                    break;

                                case "blocked":
                                    blocked++;
                                    break;

                                case "cancelled":
                                case "canceled":
                                    cancelled++;
                                    break;

                                default:
                                    break;
                            }

                        }
                    );


                    /* =================================================
                       ACTIVE SUPPLIER COUNT
                       ================================================= */

                    const supplierIds =
                        new Set(
                            filteredOrders
                                .map(function (po) {

                                    return String(
                                        po.supplier_ID || ""
                                    );

                                })
                                .filter(Boolean)
                        );


                    /* =================================================
                       MONTHLY SPEND
                       ================================================= */

                    const reportYear =
                        this._getReportYear(filters);


                    const monthlyValues =
                        Array(12).fill(0);


                    filteredOrders.forEach(
                        function (po) {

                            if (!po.documentDate) {
                                return;
                            }

                            const date =
                                new Date(
                                    `${String(
                                        po.documentDate
                                    ).slice(0, 10)}T00:00:00`
                                );


                            if (
                                date.getFullYear() ===
                                reportYear
                            ) {

                                const month =
                                    date.getMonth();

                                monthlyValues[month] +=
                                    getPOValue(po);
                            }

                        }
                    );


                    const monthNames = [
                        "Jan",
                        "Feb",
                        "Mar",
                        "Apr",
                        "May",
                        "Jun",
                        "Jul",
                        "Aug",
                        "Sep",
                        "Oct",
                        "Nov",
                        "Dec"
                    ];


                    const monthlySpend =
                        monthlyValues.map(
                            function (value, index) {

                                return {
                                    month:
                                        monthNames[index],

                                    spend:
                                        Number(
                                            value.toFixed(2)
                                        )
                                };

                            }
                        );


                    /* =================================================
                       STATUS CHART
                       ================================================= */

                    const statusCounts = {

                        Released: 0,

                        Pending: 0,

                        Blocked: 0,

                        Rejected: 0,

                        Cancelled: 0

                    };


                    filteredOrders.forEach(
                        function (po) {

                            const status =
                                String(
                                    po.status || ""
                                )
                                    .trim()
                                    .toLowerCase();


                            if (
                                status ===
                                "released"
                            ) {

                                statusCounts.Released++;

                            } else if (
                                status ===
                                "pending"
                            ) {

                                statusCounts.Pending++;

                            } else if (
                                status ===
                                "blocked"
                            ) {

                                statusCounts.Blocked++;

                            } else if (
                                status ===
                                "rejected"
                            ) {

                                statusCounts.Rejected++;

                            } else if (
                                status ===
                                "cancelled" ||
                                status ===
                                "canceled"
                            ) {

                                statusCounts.Cancelled++;
                            }

                        }
                    );


                    const statusData = [

                        {
                            status: "Released",
                            count:
                                statusCounts.Released
                        },

                        {
                            status: "Pending",
                            count:
                                statusCounts.Pending
                        },

                        {
                            status: "Blocked",
                            count:
                                statusCounts.Blocked
                        },

                        {
                            status: "Rejected",
                            count:
                                statusCounts.Rejected
                        },

                        {
                            status: "Cancelled",
                            count:
                                statusCounts.Cancelled
                        }

                    ];


                    /* =================================================
                       SUPPLIER SPEND
                       ================================================= */

                    const supplierTotals = {};


                    filteredOrders.forEach(
                        function (po) {

                            const supplierId =
                                String(
                                    po.supplier_ID || ""
                                );


                            const supplierName =
                                supplierMap[supplierId] ||
                                supplierId ||
                                "Unknown Supplier";


                            if (
                                !supplierTotals[
                                    supplierName
                                ]
                            ) {

                                supplierTotals[
                                    supplierName
                                ] = 0;
                            }


                            supplierTotals[
                                supplierName
                            ] += getPOValue(po);

                        }
                    );


                    const supplierSpend =
                        Object.keys(
                            supplierTotals
                        )
                            .map(
                                function (supplierName) {

                                    return {

                                        supplier:
                                            supplierName,

                                        spend:
                                            Number(
                                                supplierTotals[
                                                    supplierName
                                                ].toFixed(2)
                                            )

                                    };

                                }
                            )
                            .sort(
                                function (a, b) {

                                    return (
                                        b.spend -
                                        a.spend
                                    );

                                }
                            );


                    /* =================================================
                       DETAILED REPORT TABLE
                       ================================================= */

                    const reportItems =
                        filteredOrders
                            .map(
                                function (po) {

                                    const supplierId =
                                        String(
                                            po.supplier_ID ||
                                            ""
                                        );


                                    return {

                                        poNumber:
                                            po.poNumber || "",

                                        supplierName:
                                            supplierMap[
                                                supplierId
                                            ] ||
                                            supplierId ||
                                            "",

                                        documentDate:
                                            po.documentDate ||
                                            "",

                                        companyCode:
                                            po.companyCode ||
                                            "",

                                        purchasingOrg:
                                            po.purchasingOrg ||
                                            "",

                                        purchasingGroup:
                                            po.purchasingGroup ||
                                            "",

                                        netValue:
                                            Number(
                                                getPOValue(po)
                                                    .toFixed(2)
                                            ),

                                        currency:
                                            po.currency ||
                                            "INR",

                                        status:
                                            po.status ||
                                            "",

                                        approvalStatus:
                                            po.approvalStatus ||
                                            "",

                                        createdBy:
                                            po.createdBy ||
                                            ""

                                    };

                                }
                            )
                            .sort(
                                function (a, b) {

                                    return String(
                                        b.documentDate
                                    ).localeCompare(
                                        String(
                                            a.documentDate
                                        )
                                    );

                                }
                            );


                    /* =================================================
                       MONTHLY SUMMARY
                       ================================================= */

                    const monthlySummary =
                        `Year-to-date net spend: ₹ ${this._formatNumber(
                            totalSpend
                        )}`;


                    /* =================================================
                       UPDATE MODEL
                       ================================================= */

                    model.setProperty(
                        "/year",
                        String(reportYear)
                    );


                    model.setProperty(
                        "/kpis",
                        {

                            totalOrders:
                                totalOrders,

                            totalSpend:
                                this._formatNumber(
                                    totalSpend
                                ),

                            averagePO:
                                this._formatNumber(
                                    averagePO
                                ),

                            pending:
                                pending,

                            released:
                                released,

                            blocked:
                                blocked,

                            cancelled:
                                cancelled,

                            supplierCount:
                                supplierIds.size

                        }
                    );


                    model.setProperty(
                        "/monthlySpend",
                        monthlySpend
                    );


                    model.setProperty(
                        "/statusData",
                        statusData
                    );


                    model.setProperty(
                        "/supplierSpend",
                        supplierSpend
                    );


                    model.setProperty(
                        "/items",
                        reportItems
                    );


                    model.setProperty(
                        "/countText",
                        `${reportItems.length} purchase ${
                            reportItems.length === 1
                                ? "order"
                                : "orders"
                        }`
                    );


                    model.setProperty(
                        "/monthlySummary",
                        monthlySummary
                    );


                    model.setProperty(
                        "/lastUpdated",
                        `Last updated: ${this._formatDisplayDate(
                            new Date()
                        )}`
                    );

                } catch (error) {

                    console.error(
                        "Reports loading error:",
                        error
                    );

                    MessageBox.error(
                        `Unable to load procurement reports.\n\n${error.message}`
                    );
                }
            },


            /* =========================================================
               APPLY FILTERS
               ========================================================= */

            onApplyFilters: function () {

                const model =
                    this.getView()
                        .getModel("reports");


                const filters =
                    model.getProperty("/filters");


                if (
                    filters.fromDate &&
                    filters.toDate &&
                    filters.fromDate >
                    filters.toDate
                ) {

                    MessageBox.warning(
                        "From Date cannot be later than To Date."
                    );

                    return;
                }


                this._load();

                MessageToast.show(
                    "Report filters applied."
                );
            },


            /* =========================================================
               CLEAR FILTERS
               ========================================================= */
                           onClearFilters: function () {

                const today =
                    new Date();

                const year =
                    today.getFullYear();


                const model =
                    this.getView()
                        .getModel("reports");


                model.setProperty(
                    "/filters",
                    {

                        fromDate:
                            `${year}-01-01`,

                        toDate:
                            this._formatDate(
                                today
                            ),

                        supplier:
                            "",

                        status:
                            "",

                        companyCode:
                            ""

                    }
                );


                this._load();

                MessageToast.show(
                    "Report filters cleared."
                );
            },


            /* =========================================================
               REFRESH
               ========================================================= */

            onRefresh: function () {

                this._load();

                MessageToast.show(
                    "Reports refreshed."
                );
            },


            /* =========================================================
               BACK TO DASHBOARD
               ========================================================= */

            onBack: function () {

                this.getOwnerComponent()
                    .getRouter()
                    .navTo("main");
            },


            /* =========================================================
               OPEN PURCHASE ORDER FROM REPORT
               ========================================================= */

            onReportPOPress: function (event) {

                const context =
                    event.getSource()
                        .getBindingContext(
                            "reports"
                        );


                if (!context) {
                    return;
                }


                const poNumber =
                    context.getProperty(
                        "poNumber"
                    );


                if (!poNumber) {
                    return;
                }


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


            /* =========================================================
               EXPORT REPORT TO CSV
               ========================================================= */

            onExport: function () {

                const model =
                    this.getView()
                        .getModel("reports");


                const items =
                    model.getProperty("/items") ||
                    [];


                if (!items.length) {

                    MessageToast.show(
                        "There is no report data to export."
                    );

                    return;
                }


                const headers = [

                    "PO Number",

                    "Supplier",

                    "Order Date",

                    "Company Code",

                    "Purchasing Organization",

                    "Purchasing Group",

                    "Net Value",

                    "Status",

                    "Approval Status",

                    "Currency",

                    "Created By"

                ];


                const escapeCSV =
                    function (value) {

                        const text =
                            String(
                                value ?? ""
                            );

                        return `"${text.replace(
                            /"/g,
                            '""'
                        )}"`;
                    };


                const rows =
                    items.map(
                        function (item) {

                            return [

                                item.poNumber,

                                item.supplierName,

                                item.documentDate,

                                item.companyCode,

                                item.purchasingOrg,

                                item.purchasingGroup,

                                item.netValue,

                                item.status,

                                item.approvalStatus,

                                item.currency,

                                item.createdBy

                            ]
                                .map(escapeCSV)
                                .join(",");

                        }
                    );


                const csv =
                    [
                        headers
                            .map(escapeCSV)
                            .join(","),

                        ...rows

                    ].join("\n");


                const blob =
                    new Blob(
                        [csv],
                        {
                            type:
                                "text/csv;charset=utf-8;"
                        }
                    );


                const url =
                    URL.createObjectURL(blob);


                const link =
                    document.createElement(
                        "a"
                    );


                link.href = url;

                link.download =
                    `Purchase_Order_Report_${this._formatDate(
                        new Date()
                    )}.csv`;


                document.body.appendChild(
                    link
                );

                link.click();

                document.body.removeChild(
                    link
                );

                URL.revokeObjectURL(
                    url
                );


                MessageToast.show(
                    "Purchase Order report exported successfully."
                );
            },


            /* =========================================================
               STATUS FORMATTER
               ========================================================= */

            statusState: function (status) {

                const value =
                    String(
                        status || ""
                    )
                        .trim()
                        .toLowerCase();


                switch (value) {

                    case "released":
                        return "Success";

                    case "pending":
                        return "Warning";

                    case "blocked":
                    case "rejected":
                        return "Error";

                    case "cancelled":
                    case "canceled":
                        return "None";

                    default:
                        return "None";
                }
            },


            /* =========================================================
               APPROVAL STATUS FORMATTER
               ========================================================= */

            approvalState: function (status) {

                const value =
                    String(
                        status || ""
                    )
                        .trim()
                        .toLowerCase();


                if (
                    value === "approved" ||
                    value === "released"
                ) {

                    return "Success";
                }


                if (
                    value === "pending" ||
                    value === "pending approval"
                ) {

                    return "Warning";
                }


                if (
                    value === "rejected" ||
                    value === "blocked"
                ) {

                    return "Error";
                }


                return "None";
            },


            /* =========================================================
               EMPTY MONTH DATA
               ========================================================= */

            _emptyMonthlyData: function () {

                const months = [

                    "Jan",
                    "Feb",
                    "Mar",
                    "Apr",
                    "May",
                    "Jun",
                    "Jul",
                    "Aug",
                    "Sep",
                    "Oct",
                    "Nov",
                    "Dec"

                ];


                return months.map(
                    function (month) {

                        return {

                            month:
                                month,

                            spend:
                                0

                        };

                    }
                );
            },


            /* =========================================================
               DETERMINE REPORT YEAR
               ========================================================= */

            _getReportYear: function (filters) {

                if (
                    filters &&
                    filters.fromDate
                ) {

                    const date =
                        new Date(
                            `${filters.fromDate}T00:00:00`
                        );


                    if (
                        !Number.isNaN(
                            date.getTime()
                        )
                    ) {

                        return date.getFullYear();
                    }
                }


                return new Date()
                    .getFullYear();
            },


            /* =========================================================
               DATE FORMAT: YYYY-MM-DD
               ========================================================= */

            _formatDate: function (date) {

                const year =
                    date.getFullYear();


                const month =
                    String(
                        date.getMonth() + 1
                    ).padStart(
                        2,
                        "0"
                    );


                const day =
                    String(
                        date.getDate()
                    ).padStart(
                        2,
                        "0"
                    );


                return `${year}-${month}-${day}`;
            },


            /* =========================================================
               DISPLAY DATE
               ========================================================= */

            _formatDisplayDate: function (date) {

                return date.toLocaleDateString(
                    "en-IN",
                    {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    }
                );
            },


            /* =========================================================
               INDIAN NUMBER FORMAT
               ========================================================= */

            _formatNumber: function (value) {

                return Number(
                    value || 0
                ).toLocaleString(
                    "en-IN",
                    {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }
                );
            }

        }
    );
});