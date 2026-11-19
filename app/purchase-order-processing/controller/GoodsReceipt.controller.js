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
        "purchaseorderprocessing.controller.GoodsReceipt",
        {

            onInit: function () {

                this.getOwnerComponent()
                    .getRouter()
                    .getRoute("goodsReceipt")
                    .attachPatternMatched(
                        this._load,
                        this
                    );

                this.getView().setModel(
                    new JSONModel({
                        poNumber: "",
                        postingDate:
                            new Date()
                                .toISOString()
                                .slice(0, 10),

                        deliveryNote: "",

                        items: [],

                        loading: false,
                        posting: false,

                        totalOrdered: 0,
                        totalReceived: 0,
                        totalRemaining: 0
                    }),
                    "receipt"
                );
            },


            _load: async function (event) {

                const poNumber =
                    event.getParameter(
                        "arguments"
                    ).poNumber;

                const model =
                    this.getView()
                        .getModel("receipt");

                model.setProperty(
                    "/loading",
                    true
                );

                try {

                    const [
                        poRes,
                        itemRes,
                        receiptItemRes
                    ] = await Promise.all([

                        api.get(
                            "PurchaseOrders",
                            `'${poNumber}'`
                        ),

                        api.query(
                            "PurchaseOrderItems",
                            `$filter=${encodeURIComponent(
                                `poNumber eq '${poNumber}'`
                            )}`
                        ),

                        api.query(
                            "GoodsReceiptItems",
                            `$filter=${encodeURIComponent(
                                `poNumber eq '${poNumber}'`
                            )}`
                        )
                    ]);

                    const poItems =
                        itemRes.value || [];

                    const receiptItems =
                        receiptItemRes.value || [];

                    const receivedMap = {};

                    receiptItems.forEach(
                        function (receiptItem) {

                            const itemId =
                                receiptItem.itemId;

                            receivedMap[itemId] =
                                (
                                    receivedMap[itemId] ||
                                    0
                                ) +
                                Number(
                                    receiptItem.quantity ||
                                    0
                                );
                        }
                    );

                    let totalOrdered = 0;
                    let totalReceived = 0;

                    const items =
                        poItems.map(
                            function (item) {

                                const ordered =
                                    Number(
                                        item.quantity ||
                                        0
                                    );

                                const received =
                                    Number(
                                        receivedMap[
                                            item.itemId
                                        ] || 0
                                    );

                                const remaining =
                                    Math.max(
                                        0,
                                        ordered -
                                        received
                                    );

                                totalOrdered +=
                                    ordered;

                                totalReceived +=
                                    received;

                                return {

                                    ...item,

                                    receivedQuantity:
                                        received,

                                    remainingQuantity:
                                        remaining,

                                    receiptQuantity:
                                        0,

                                    itemStatus:
                                        remaining === 0
                                            ? "Fully Received"
                                            : received > 0
                                            ? "Partially Received"
                                            : "Open"
                                };
                            }
                        );

                    model.setData({

                        poNumber,

                        postingDate:
                            new Date()
                                .toISOString()
                                .slice(0, 10),

                        deliveryNote: "",

                        items,

                        loading: false,
                        posting: false,

                        totalOrdered,

                        totalReceived,

                        totalRemaining:
                            Math.max(
                                0,
                                totalOrdered -
                                totalReceived
                            )
                    });

                } catch (error) {

                    model.setProperty(
                        "/loading",
                        false
                    );

                    MessageBox.error(
                        `Unable to load Goods Receipt information.\n\n${error.message}`
                    );

                    console.error(
                        "Goods Receipt load error:",
                        error
                    );
                }
            },


            onQuantityChange: function (event) {

                const input =
                    event.getSource();

                const context =
                    input.getBindingContext(
                        "receipt"
                    );

                if (!context) {
                    return;
                }

                const path =
                    context.getPath();

                const model =
                    this.getView()
                        .getModel("receipt");

                let value =
                    Number(
                        input.getValue()
                    );

                if (
                    !Number.isFinite(value) ||
                    value < 0
                ) {
                    value = 0;
                }

                const remaining =
                    Number(
                        model.getProperty(
                            path +
                            "/remainingQuantity"
                        )
                    ) || 0;

                if (value > remaining) {

                    value = remaining;

                    MessageBox.warning(
                        `Received quantity cannot exceed the remaining quantity of ${remaining}.`
                    );
                }

                model.setProperty(
                    path +
                    "/receiptQuantity",
                    value
                );
            },


            onPostGoodsReceipt: function () {

                const model =
                    this.getView()
                        .getModel("receipt");

                const data =
                    model.getData();

                const selectedItems =
                    data.items.filter(
                        function (item) {

                            return Number(
                                item.receiptQuantity
                            ) > 0;
                        }
                    );

                if (
                    selectedItems.length === 0
                ) {

                    MessageBox.warning(
                        "Enter a received quantity for at least one item."
                    );

                    return;
                }

                if (
                    !data.postingDate
                ) {

                    MessageBox.warning(
                        "Posting date is required."
                    );

                    return;
                }

                const totalReceivedNow =
                    selectedItems.reduce(
                        function (
                            sum,
                            item
                        ) {

                            return sum +
                                Number(
                                    item.receiptQuantity ||
                                    0
                                );

                        },
                        0
                    );

                MessageBox.confirm(
                    `Post Goods Receipt for ${totalReceivedNow} units?`,
                    {
                        title:
                            "Post Goods Receipt",

                        actions: [
                            MessageBox.Action.OK,
                            MessageBox.Action.CANCEL
                        ],

                        emphasizedAction:
                            MessageBox.Action.OK,

                        onClose:
                            async function (action) {

                                if (
                                    action !==
                                    MessageBox.Action.OK
                                ) {
                                    return;
                                }

                                model.setProperty(
                                    "/posting",
                                    true
                                );

                                try {

                                    await api.action(
                                        "postGoodsReceipt",
                                        {
                                            poNumber:
                                                data.poNumber,

                                            postingDate:
                                                data.postingDate,

                                            deliveryNote:
                                                data.deliveryNote ||
                                                "",

                                            items:
                                                selectedItems.map(
                                                    function (
                                                        item
                                                    ) {

                                                        return {
                                                            itemId:
                                                                item.itemId,

                                                            quantity:
                                                                Number(
                                                                    item.receiptQuantity
                                                                )
                                                        };
                                                    }
                                                )
                                        }
                                    );

                                    MessageToast.show(
                                        "Goods Receipt posted successfully."
                                    );

                                    /*
                                     * Reload so the
                                     * received quantities
                                     * are refreshed.
                                     */
                                    await this._load({
                                        getParameter:
                                            function () {
                                                return {
                                                    poNumber:
                                                        data.poNumber
                                                };
                                            }
                                    });

                                } catch (error) {

                                    MessageBox.error(
                                        error.message ||
                                        "Unable to post Goods Receipt."
                                    );

                                } finally {

                                    model.setProperty(
                                        "/posting",
                                        false
                                    );
                                }

                            }.bind(this)
                    }
                );
            },


            onBack: function () {

                this.getOwnerComponent()
                    .getRouter()
                    .navTo(
                        "poDetail",
                        {
                            poNumber:
                                this.getView()
                                    .getModel("receipt")
                                    .getProperty(
                                        "/poNumber"
                                    )
                        }
                    );
            }

        }
    );
});