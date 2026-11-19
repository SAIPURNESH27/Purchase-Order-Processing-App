const cds = require("@sap/cds");

module.exports = cds.service.impl(async function () {

  const {
    PurchaseOrders,
    PurchaseOrderItems,
    Suppliers,
    Approvals,
    GoodsReceipts,
    GoodsReceiptItems,
    PurchaseOrderStatusHistory
  } = cds.entities("purchase.order.processing");


  // ============================================================
  // HELPERS
  // ============================================================

  const now = () => new Date().toISOString();


  const nextPoNumber = async () => {

    const rows = await cds.db.run(
      SELECT
        .from(PurchaseOrders)
        .columns("poNumber")
        .orderBy("poNumber desc")
        .limit(1)
    );

    const current = rows?.[0]?.poNumber
      ? Number(rows[0].poNumber)
      : 45000122;

    return String(current + 1);
  };


  const totalForPO = async (poNumber) => {

    const rows = await cds.db.run(
      SELECT
        .from(PurchaseOrderItems)
        .where({ poNumber })
    );

    return rows.reduce(
      (sum, row) =>
        sum + Number(row.netValue || 0),
      0
    );
  };


  const getSupplierName = async (supplierId) => {

    if (!supplierId) {
      return "";
    }

    const supplier =
      await cds.db.run(
        SELECT.one
          .from(Suppliers)
          .where({
            ID: supplierId
          })
      );

    return supplier?.name || "";
  };


  const getPurchaseOrder = async (poNumber) => {

    return await cds.db.run(
      SELECT.one
        .from(PurchaseOrders)
        .where({
          poNumber
        })
    );
  };


  // ============================================================
  // STEP 9
  // STATUS HISTORY
  // ============================================================

  const recordStatusChange = async ({
    poNumber,
    fromStatus,
    toStatus,
    action,
    changedBy,
    comment = ""
  }) => {

    if (!poNumber || !toStatus) {
      return;
    }

    const historyId =
      `H-${poNumber}-${Date.now()}`;

    await cds.db.run(
      INSERT.into(
        PurchaseOrderStatusHistory
      ).entries({

        historyId,

        poNumber,

        fromStatus:
          fromStatus || "",

        toStatus,

        action:
          action || "",

        changedBy:
          changedBy ||
          "Sai Purnesh",

        changedAt:
          now(),

        comment:
          comment || ""
      })
    );
  };


  // ============================================================
  // GET USER PERFORMING ACTION
  // ============================================================

  const getChangedBy = (
    req,
    fallback = "Sai Purnesh"
  ) => {

    return (
      req.user?.id ||
      req.user?.attr?.email ||
      fallback
    );
  };


  // ============================================================
  // GET RECEIVED QUANTITIES
  // ============================================================

  const getReceivedQuantities = async (
    poNumber
  ) => {

    const rows = await cds.db.run(
      SELECT
        .from(GoodsReceiptItems)
        .where({
          poNumber
        })
    );

    const received = {};

    for (const row of rows) {

      const itemId =
        row.itemId;

      if (!itemId) {
        continue;
      }

      received[itemId] =
        (received[itemId] || 0) +
        Number(row.quantity || 0);
    }

    return received;
  };


  // ============================================================
  // UPDATE RECEIVING STATUS
  //
  // Released
  //     ↓
  // Partially Received
  //     ↓
  // Fully Received
  // ============================================================

  const updateReceiptStatus = async (
    poNumber,
    changedBy = "Sai Purnesh"
  ) => {

    const po =
      await getPurchaseOrder(
        poNumber
      );

    if (!po) {
      return null;
    }


    const poItems =
      await cds.db.run(
        SELECT
          .from(PurchaseOrderItems)
          .where({
            poNumber
          })
      );


    if (!poItems.length) {
      return null;
    }


    const hasValidQuantity =
      poItems.some(
        item =>
          Number(
            item.quantity || 0
          ) > 0
      );


    if (!hasValidQuantity) {
      return null;
    }


    const receivedQuantities =
      await getReceivedQuantities(
        poNumber
      );


    let totalOrdered = 0;
    let totalReceived = 0;


    for (const item of poItems) {

      const ordered =
        Number(
          item.quantity || 0
        );

      const received =
        Number(
          receivedQuantities[
            item.itemId
          ] || 0
        );

      totalOrdered +=
        ordered;

      totalReceived +=
        received;
    }


    let newStatus =
      po.status;


    if (totalReceived <= 0) {

      if (
        po.status ===
          "Released" ||
        po.status ===
          "Partially Received"
      ) {

        newStatus =
          "Released";
      }

    } else if (
      totalReceived <
      totalOrdered
    ) {

      newStatus =
        "Partially Received";

    } else {

      newStatus =
        "Fully Received";
    }


    // ----------------------------------------------------------
    // Update status and record history
    // ----------------------------------------------------------

    if (
      newStatus !==
      po.status
    ) {

      await cds.db.run(
        UPDATE(PurchaseOrders)
          .set({

            status:
              newStatus,

            changedAt:
              now()

          })
          .where({
            poNumber
          })
      );


      await recordStatusChange({

        poNumber,

        fromStatus:
          po.status,

        toStatus:
          newStatus,

        action:
          "Goods Receipt",

        changedBy,

        comment:
          "Purchase Order receiving status updated automatically."
      });
    }


    return {

      totalOrdered,

      totalReceived,

      totalRemaining:
        Math.max(
          0,
          totalOrdered -
          totalReceived
        ),

      status:
        newStatus
    };
  };


  // ============================================================
  // STRICT LIFECYCLE VALIDATION
  // ============================================================

  const requireStatus = (
    req,
    po,
    allowedStatuses,
    actionName
  ) => {

    if (
      !allowedStatuses.includes(
        po.status
      )
    ) {

      req.error(
        400,
        `Purchase Order ${po.poNumber} cannot perform "${actionName}" while its current status is "${po.status}".`
      );
    }
  };


  // ============================================================
  // APPROVAL SYNCHRONIZATION
  // ============================================================

  const syncApproval = async (
    poNumber
  ) => {

    const po =
      await getPurchaseOrder(
        poNumber
      );

    if (!po) {
      return;
    }


    if (
      po.status !==
      "Pending Approval"
    ) {
      return;
    }


    const total =
      await totalForPO(
        poNumber
      );


    const supplierName =
      await getSupplierName(
        po.supplier_ID
      );


    const existing =
      await cds.db.run(
        SELECT.one
          .from(Approvals)
          .where({
            poNumber
          })
      );


    if (existing) {

      await cds.db.run(
        UPDATE(Approvals)
          .set({

            amount:
              total,

            supplier:
              supplierName ||
              existing.supplier ||
              ""

          })
          .where({
            poNumber
          })
      );

      return;
    }


    await cds.db.run(
      INSERT.into(
        Approvals
      ).entries({

        approvalId:
          `A-${poNumber}`,

        poNumber,

        supplier:
          supplierName,

        amount:
          total,

        createdBy:
          po.createdBy || "",

        createdOn:
          po.documentDate,

        approver:
          "Procurement Manager",

        status:
          "Pending",

        comments:
          ""
      })
    );
  };


  // ============================================================
  // CREATE PURCHASE ORDER
  // ============================================================

  this.before(
    "CREATE",
    "PurchaseOrders",
    async (req) => {

      if (!req.data.poNumber) {

        req.data.poNumber =
          await nextPoNumber();
      }


      req.data.documentDate ??=
        new Date()
          .toISOString()
          .slice(0, 10);


      req.data.createdAt ??=
        now();


      req.data.changedAt =
        now();


      req.data.status ??=
        "Draft";


      req.data.approvalStatus ??=
        "Draft";


      req.data.createdBy ??=
        "Sai Purnesh";


      req.data.currency ??=
        "INR";
    }
  );


  // ============================================================
  // UPDATE PURCHASE ORDER
  // ============================================================

  this.before(
    "UPDATE",
    "PurchaseOrders",
    async (req) => {

      const poNumber =
        req.data.poNumber ||
        req.params?.[0]?.poNumber;


      if (poNumber) {

        const existing =
          await getPurchaseOrder(
            poNumber
          );


        if (existing) {

          const protectedStatuses = [

            "Submitted",
            "Pending Approval",
            "Approved",
            "Released",
            "Partially Received",
            "Fully Received",
            "Closed",
            "Cancelled"

          ];


          if (
            protectedStatuses.includes(
              existing.status
            )
          ) {

            req.error(
              400,
              `Purchase Order ${poNumber} cannot be edited while its status is "${existing.status}".`
            );
          }
        }
      }


      req.data.changedAt =
        now();
    }
  );


  // ============================================================
  // CREATE PURCHASE ORDER ITEM
  // ============================================================

  this.before(
    "CREATE",
    "PurchaseOrderItems",
    (req) => {

      req.data.itemId ??=
        `${req.data.poNumber}-${Date.now()}`;


      req.data.netValue =
        Number(
          req.data.quantity || 0
        ) *
        Number(
          req.data.unitPrice || 0
        );


      req.data.status ??=
        "Open";
    }
  );


  // ============================================================
  // UPDATE PURCHASE ORDER ITEM
  // ============================================================

  this.before(
    "UPDATE",
    "PurchaseOrderItems",
    async (req) => {

      const itemId =
        req.data.itemId ||
        req.params?.[0]?.itemId;


      if (itemId) {

        const existing =
          await cds.db.run(
            SELECT.one
              .from(
                PurchaseOrderItems
              )
              .where({
                itemId
              })
          );


        if (existing?.poNumber) {

          const po =
            await getPurchaseOrder(
              existing.poNumber
            );


          if (
            po &&
            po.status !==
              "Draft"
          ) {

            req.error(
              400,
              `Items cannot be edited while Purchase Order ${po.poNumber} is in "${po.status}" status.`
            );
          }
        }
      }


      if (
        req.data.quantity !==
          undefined ||
        req.data.unitPrice !==
          undefined
      ) {

        const existing =
          itemId
            ? await cds.db.run(
                SELECT.one
                  .from(
                    PurchaseOrderItems
                  )
                  .where({
                    itemId
                  })
              )
            : null;


        const quantity =
          req.data.quantity !==
            undefined
            ? req.data.quantity
            : existing?.quantity ||
              0;


        const unitPrice =
          req.data.unitPrice !==
            undefined
            ? req.data.unitPrice
            : existing?.unitPrice ||
              0;


        req.data.netValue =
          Number(quantity) *
          Number(unitPrice);
      }
    }
  );


  // ============================================================
  // KEEP PO CHANGED AT UPDATED
  // ============================================================

  this.after(
    [
      "CREATE",
      "UPDATE",
      "DELETE"
    ],
    "PurchaseOrderItems",
    async (data) => {

      const rows =
        Array.isArray(data)
          ? data
          : [data];


      for (
        const item of rows
      ) {

        if (!item?.poNumber) {
          continue;
        }


        await cds.db.run(
          UPDATE(PurchaseOrders)
            .set({
              changedAt:
                now()
            })
            .where({
              poNumber:
                item.poNumber
            })
        );


        await syncApproval(
          item.poNumber
        );
      }
    }
  );


  // ============================================================
  // STEP 1
  // Draft → Submitted
  // ============================================================

  this.on(
    "submitPurchaseOrder",
    async (req) => {

      const {
        poNumber
      } = req.data;


      if (!poNumber) {

        return req.error(
          400,
          "Purchase Order number is required."
        );
      }


      const po =
        await getPurchaseOrder(
          poNumber
        );


      if (!po) {

        return req.error(
          404,
          `Purchase Order ${poNumber} not found.`
        );
      }


      requireStatus(
        req,
        po,
        ["Draft"],
        "Submit"
      );


      const total =
        await totalForPO(
          poNumber
        );


      if (total <= 0) {

        return req.error(
          400,
          `Purchase Order ${poNumber} cannot be submitted without items or a valid total amount.`
        );
      }


      await cds.db.run(
        UPDATE(PurchaseOrders)
          .set({

            status:
              "Submitted",

            approvalStatus:
              "Submitted",

            changedAt:
              now()

          })
          .where({
            poNumber
          })
      );


      // STEP 9
      await recordStatusChange({

        poNumber,

        fromStatus:
          po.status,

        toStatus:
          "Submitted",

        action:
          "Submit",

        changedBy:
          getChangedBy(req),

        comment:
          ""
      });


      return (
        `Purchase Order ${poNumber} submitted successfully.`
      );
    }
  );


  // ============================================================
  // STEP 2
  // Submitted → Pending Approval
  // ============================================================

  this.on(
    "sendForApproval",
    async (req) => {

      const {
        poNumber
      } = req.data;


      if (!poNumber) {

        return req.error(
          400,
          "Purchase Order number is required."
        );
      }


      const po =
        await getPurchaseOrder(
          poNumber
        );


      if (!po) {

        return req.error(
          404,
          `Purchase Order ${poNumber} not found.`
        );
      }


      requireStatus(
        req,
        po,
        ["Submitted"],
        "Send for Approval"
      );


      const total =
        await totalForPO(
          poNumber
        );


      if (total <= 0) {

        return req.error(
          400,
          `Purchase Order ${poNumber} cannot be sent for approval without a valid total amount.`
        );
      }


      await cds.db.run(
        UPDATE(PurchaseOrders)
          .set({

            status:
              "Pending Approval",

            approvalStatus:
              "Pending Approval",

            changedAt:
              now()

          })
          .where({
            poNumber
          })
      );


      await syncApproval(
        poNumber
      );


      // STEP 9
      await recordStatusChange({

        poNumber,

        fromStatus:
          po.status,

        toStatus:
          "Pending Approval",

        action:
          "Send for Approval",

        changedBy:
          getChangedBy(req),

        comment:
          ""
      });


      return (
        `Purchase Order ${poNumber} sent for approval.`
      );
    }
  );


  // ============================================================
  // Pending Approval → Approved
  // ============================================================

  this.on(
    "approvePurchaseOrder",
    async (req) => {

      const {
        poNumber,
        comment
      } = req.data;


      if (!poNumber) {

        return req.error(
          400,
          "Purchase Order number is required."
        );
      }


      const po =
        await getPurchaseOrder(
          poNumber
        );


      if (!po) {

        return req.error(
          404,
          `Purchase Order ${poNumber} not found.`
        );
      }


      requireStatus(
        req,
        po,
        ["Pending Approval"],
        "Approve"
      );


      await cds.db.run(
        UPDATE(PurchaseOrders)
          .set({

            status:
              "Approved",

            approvalStatus:
              "Approved",

            changedAt:
              now()

          })
          .where({
            poNumber
          })
      );


      const existing =
        await cds.db.run(
          SELECT.one
            .from(Approvals)
            .where({
              poNumber
            })
        );


      if (existing) {

        await cds.db.run(
          UPDATE(Approvals)
            .set({

              status:
                "Approved",

              comments:
                comment || "",

              approver:
                "Procurement Manager"

            })
            .where({
              poNumber
            })
        );

      } else {

        const total =
          await totalForPO(
            poNumber
          );


        const supplierName =
          await getSupplierName(
            po.supplier_ID
          );


        await cds.db.run(
          INSERT.into(
            Approvals
          ).entries({

            approvalId:
              `A-${poNumber}`,

            poNumber,

            supplier:
              supplierName,

            amount:
              total,

            createdBy:
              po.createdBy || "",

            createdOn:
              po.documentDate,

            approver:
              "Procurement Manager",

            status:
              "Approved",

            comments:
              comment || ""
          })
        );
      }


      // STEP 9
      await recordStatusChange({

        poNumber,

        fromStatus:
          po.status,

        toStatus:
          "Approved",

        action:
          "Approve",

        changedBy:
          getChangedBy(
            req,
            "Procurement Manager"
          ),

        comment:
          comment || ""
      });


      return (
        `Purchase Order ${poNumber} approved successfully.`
      );
    }
  );


  // ============================================================
  // Pending Approval → Rejected
  // ============================================================

  this.on(
    "rejectPurchaseOrder",
    async (req) => {

      const {
        poNumber,
        comment
      } = req.data;


      if (!poNumber) {

        return req.error(
          400,
          "Purchase Order number is required."
        );
      }


      if (
        !comment ||
        !String(comment).trim()
      ) {

        return req.error(
          400,
          "A rejection comment is required."
        );
      }


      const po =
        await getPurchaseOrder(
          poNumber
        );


      if (!po) {

        return req.error(
          404,
          `Purchase Order ${poNumber} not found.`
        );
      }


      requireStatus(
        req,
        po,
        ["Pending Approval"],
        "Reject"
      );


      await cds.db.run(
        UPDATE(PurchaseOrders)
          .set({

            status:
              "Rejected",

            approvalStatus:
              "Rejected",

            changedAt:
              now()

          })
          .where({
            poNumber
          })
      );


      const existing =
        await cds.db.run(
          SELECT.one
            .from(Approvals)
            .where({
              poNumber
            })
        );


      if (existing) {

        await cds.db.run(
          UPDATE(Approvals)
            .set({

              status:
                "Rejected",

              comments:
                String(
                  comment
                ).trim(),

              approver:
                "Procurement Manager"

            })
            .where({
              poNumber
            })
        );

      } else {

        const total =
          await totalForPO(
            poNumber
          );


        const supplierName =
          await getSupplierName(
            po.supplier_ID
          );


        await cds.db.run(
          INSERT.into(
            Approvals
          ).entries({

            approvalId:
              `A-${poNumber}`,

            poNumber,

            supplier:
              supplierName,

            amount:
              total,

            createdBy:
              po.createdBy || "",

            createdOn:
              po.documentDate,

            approver:
              "Procurement Manager",

            status:
              "Rejected",

            comments:
              String(
                comment
              ).trim()
          })
        );
      }


      // STEP 9
      await recordStatusChange({

        poNumber,

        fromStatus:
          po.status,

        toStatus:
          "Rejected",

        action:
          "Reject",

        changedBy:
          getChangedBy(
            req,
            "Procurement Manager"
          ),

        comment:
          String(
            comment
          ).trim()
      });


      return (
        `Purchase Order ${poNumber} rejected successfully.`
      );
    }
  );


  // ============================================================
  // Approved → Released
  // ============================================================

  this.on(
    "releasePurchaseOrder",
    async (req) => {

      const {
        poNumber
      } = req.data;


      if (!poNumber) {

        return req.error(
          400,
          "Purchase Order number is required."
        );
      }


      const po =
        await getPurchaseOrder(
          poNumber
        );


      if (!po) {

        return req.error(
          404,
          `Purchase Order ${poNumber} not found.`
        );
      }


      requireStatus(
        req,
        po,
        ["Approved"],
        "Release"
      );


      await cds.db.run(
        UPDATE(PurchaseOrders)
          .set({

            status:
              "Released",

            approvalStatus:
              "Approved",

            changedAt:
              now()

          })
          .where({
            poNumber
          })
      );


      // STEP 9
      await recordStatusChange({

        poNumber,

        fromStatus:
          po.status,

        toStatus:
          "Released",

        action:
          "Release",

        changedBy:
          getChangedBy(req),

        comment:
          ""
      });


      return (
        `Purchase Order ${poNumber} released successfully.`
      );
    }
  );


  // ============================================================
  // STEP 6 + STEP 7
  // GOODS RECEIPT
  // ============================================================

  this.on(
    "postGoodsReceipt",
    async (req) => {

      const {
        poNumber,
        postingDate,
        deliveryNote,
        items
      } = req.data;


      // --------------------------------------------------------
      // BASIC VALIDATION
      // --------------------------------------------------------

      if (!poNumber) {

        return req.error(
          400,
          "Purchase Order number is required."
        );
      }


      if (
        !Array.isArray(items) ||
        items.length === 0
      ) {

        return req.error(
          400,
          "At least one item quantity is required."
        );
      }


      // --------------------------------------------------------
      // GET PURCHASE ORDER
      // --------------------------------------------------------

      const po =
        await getPurchaseOrder(
          poNumber
        );


      if (!po) {

        return req.error(
          404,
          `Purchase Order ${poNumber} not found.`
        );
      }


      // --------------------------------------------------------
      // RECEIPT ALLOWED ONLY FOR:
      //
      // Released
      // Partially Received
      // --------------------------------------------------------

      requireStatus(
        req,
        po,
        [
          "Released",
          "Partially Received"
        ],
        "Post Goods Receipt"
      );


      // --------------------------------------------------------
      // GET PO ITEMS
      // --------------------------------------------------------

      const poItems =
        await cds.db.run(
          SELECT
            .from(PurchaseOrderItems)
            .where({
              poNumber
            })
        );


      if (!poItems.length) {

        return req.error(
          400,
          `Purchase Order ${poNumber} has no items available for goods receipt.`
        );
      }


      // --------------------------------------------------------
      // CREATE ITEM LOOKUP
      // --------------------------------------------------------

      const itemMap =
        new Map(
          poItems.map(
            item => [
              item.itemId,
              item
            ]
          )
        );


      // --------------------------------------------------------
      // GET PREVIOUSLY RECEIVED QUANTITIES
      // --------------------------------------------------------

      const receivedQuantities =
        await getReceivedQuantities(
          poNumber
        );


      // --------------------------------------------------------
      // PREVENT DUPLICATE ITEMS
      // --------------------------------------------------------

      const submittedItemIds =
        new Set();


      // --------------------------------------------------------
      // VALIDATE RECEIPT LINES
      // --------------------------------------------------------

      for (
        const line of items
      ) {

        if (!line.itemId) {

          return req.error(
            400,
            "Receipt item ID is required."
          );
        }


        if (
          submittedItemIds.has(
            line.itemId
          )
        ) {

          return req.error(
            400,
            `Item ${line.itemId} appears more than once in the same goods receipt.`
          );
        }


        submittedItemIds.add(
          line.itemId
        );


        const poItem =
          itemMap.get(
            line.itemId
          );


        if (!poItem) {

          return req.error(
            400,
            `Item ${line.itemId} does not belong to Purchase Order ${poNumber}.`
          );
        }


        const quantity =
          Number(
            line.quantity
          );


        if (
          !Number.isFinite(
            quantity
          ) ||
          quantity <= 0
        ) {

          return req.error(
            400,
            `Received quantity for item ${line.itemId} must be greater than zero.`
          );
        }


        const orderedQuantity =
          Number(
            poItem.quantity || 0
          );


        if (
          orderedQuantity <= 0
        ) {

          return req.error(
            400,
            `Item ${line.itemId} has no valid ordered quantity.`
          );
        }


        const alreadyReceived =
          Number(
            receivedQuantities[
              line.itemId
            ] || 0
          );


        const remainingQuantity =
          orderedQuantity -
          alreadyReceived;


        if (
          quantity >
          remainingQuantity
        ) {

          return req.error(
            400,
            `Received quantity for item ${line.itemId} cannot exceed the remaining quantity of ${Math.max(0, remainingQuantity)}.`
          );
        }
      }


      // --------------------------------------------------------
      // POSTING DATE
      // --------------------------------------------------------

      const receiptDate =
        postingDate ||
        new Date()
          .toISOString()
          .slice(0, 10);


      // --------------------------------------------------------
      // GOODS RECEIPT ID
      // --------------------------------------------------------

      const receiptId =
        `GR-${poNumber}-${Date.now()}`;


      // --------------------------------------------------------
      // RECEIVED BY
      // --------------------------------------------------------

      const receivedBy =
        getChangedBy(req);


      // --------------------------------------------------------
      // CREATE GOODS RECEIPT HEADER
      // --------------------------------------------------------

      await cds.db.run(
        INSERT.into(
          GoodsReceipts
        ).entries({

          receiptId,

          poNumber,

          postingDate:
            receiptDate,

          receivedBy,

          deliveryNote:
            deliveryNote ||
            "",

          status:
            "Posted",

          createdAt:
            now()
        })
      );


      // --------------------------------------------------------
      // CREATE GOODS RECEIPT ITEMS
      // --------------------------------------------------------

      const receiptItems =
        items.map(
          (
            line,
            index
          ) => {

            const poItem =
              itemMap.get(
                line.itemId
              );


            return {

              receiptItemId:
                `${receiptId}-${index + 1}`,

              receiptId,

              poNumber,

              itemId:
                line.itemId,

              material:
                poItem.material ||
                "",

              description:
                poItem.description ||
                "",

              quantity:
                Number(
                  line.quantity
                ),

              unit:
                poItem.unit ||
                "",

              receivedDate:
                receiptDate
            };
          }
        );


      await cds.db.run(
        INSERT.into(
          GoodsReceiptItems
        ).entries(
          receiptItems
        )
      );


      // --------------------------------------------------------
      // RECALCULATE RECEIVING STATUS
      // --------------------------------------------------------

      const receiptStatus =
        await updateReceiptStatus(
          poNumber,
          getChangedBy(req)
        );


      if (!receiptStatus) {

        return (
          `Goods Receipt ${receiptId} posted successfully for Purchase Order ${poNumber}.`
        );
      }


      return (
        `Goods Receipt ${receiptId} posted successfully for Purchase Order ${poNumber}. ` +
        `Purchase Order status: ${receiptStatus.status}.`
      );
    }
  );


  // ============================================================
  // STEP 8
  // Released → Cancelled
  // ============================================================

  this.on(
    "cancelPurchaseOrder",
    async (req) => {

      const {
        poNumber,
        comment
      } = req.data;


      if (!poNumber) {

        return req.error(
          400,
          "Purchase Order number is required."
        );
      }


      if (
        !comment ||
        !String(comment).trim()
      ) {

        return req.error(
          400,
          "A cancellation reason is required."
        );
      }


      const po =
        await getPurchaseOrder(
          poNumber
        );


      if (!po) {

        return req.error(
          404,
          `Purchase Order ${poNumber} not found.`
        );
      }


      requireStatus(
        req,
        po,
        ["Released"],
        "Cancel"
      );


      await cds.db.run(
        UPDATE(PurchaseOrders)
          .set({

            status:
              "Cancelled",

            changedAt:
              now()

          })
          .where({
            poNumber
          })
      );


      // STEP 9
      await recordStatusChange({

        poNumber,

        fromStatus:
          po.status,

        toStatus:
          "Cancelled",

        action:
          "Cancel",

        changedBy:
          getChangedBy(req),

        comment:
          String(
            comment
          ).trim()
      });


      return (
        `Purchase Order ${poNumber} cancelled successfully.`
      );
    }
  );


  // ============================================================
  // STEP 8
  // Fully Received → Closed
  // ============================================================

  this.on(
    "closePurchaseOrder",
    async (req) => {

      const {
        poNumber
      } = req.data;


      if (!poNumber) {

        return req.error(
          400,
          "Purchase Order number is required."
        );
      }


      const po =
        await getPurchaseOrder(
          poNumber
        );


      if (!po) {

        return req.error(
          404,
          `Purchase Order ${poNumber} not found.`
        );
      }


      requireStatus(
        req,
        po,
        ["Fully Received"],
        "Close"
      );


      await cds.db.run(
        UPDATE(PurchaseOrders)
          .set({

            status:
              "Closed",

            changedAt:
              now()

          })
          .where({
            poNumber
          })
      );


      // STEP 9
      await recordStatusChange({

        poNumber,

        fromStatus:
          po.status,

        toStatus:
          "Closed",

        action:
          "Close",

        changedBy:
          getChangedBy(req),

        comment:
          ""
      });


      return (
        `Purchase Order ${poNumber} closed successfully.`
      );
    }
  );

    // ============================================================
  // DAILY APPROVAL MONITOR — READ ONLY
  // ============================================================

  this.on("runDailyApprovalCheck", async (req) => {
    const executedAt = new Date().toISOString();

    try {
      const pendingOrders = await cds.db.run(
        SELECT.from(PurchaseOrders)
          .columns(
            "poNumber",
            "status",
            "approvalStatus",
            "createdBy",
            "documentDate"
          )
          .where({
            status: "Pending Approval"
          })
      );

      const pendingApprovals = await cds.db.run(
        SELECT.from(Approvals)
          .columns(
            "approvalId",
            "poNumber",
            "approver",
            "status",
            "createdOn"
          )
          .where({
            status: "Pending"
          })
      );

      const report = {
        job: "Daily Purchase Order Approval Monitor",
        executionTime: executedAt,
        result: "SUCCESS",
        pendingPurchaseOrderCount: pendingOrders.length,
        pendingApprovalRecordCount: pendingApprovals.length,
        pendingPurchaseOrders: pendingOrders,
        pendingApprovalRecords: pendingApprovals
      };

      console.log(
        "[DAILY APPROVAL MONITOR]",
        JSON.stringify(report)
      );

      return JSON.stringify(report);

    } catch (error) {
      console.error(
        "[DAILY APPROVAL MONITOR] Failed:",
        error
      );

      return req.reject(
        500,
        "Daily approval monitoring failed."
      );
    }
  });
});