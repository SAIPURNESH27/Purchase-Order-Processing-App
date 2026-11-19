using { purchase.order.processing as db } from '../db/schema';

@path: '/odata/v4/purchase-order-service'
service PurchaseOrderService {

  entity PurchaseOrders as projection on db.PurchaseOrders;

  entity PurchaseOrderItems as projection on db.PurchaseOrderItems;

  entity Suppliers as projection on db.Suppliers;

  entity Approvals as projection on db.Approvals;

  entity GoodsReceipts as projection on db.GoodsReceipts;

  entity GoodsReceiptItems as projection on db.GoodsReceiptItems;

  entity PurchaseOrderStatusHistory
    as projection on db.PurchaseOrderStatusHistory;


  // ============================================================
  // Purchase Order Lifecycle
  // ============================================================

  action submitPurchaseOrder(
    poNumber : String(10)
  ) returns String;

  action sendForApproval(
    poNumber : String(10)
  ) returns String;


  // ============================================================
  // Approval
  // ============================================================

  action approvePurchaseOrder(
    poNumber : String(10),
    comment : String(500)
  ) returns String;

  action rejectPurchaseOrder(
    poNumber : String(10),
    comment : String(500)
  ) returns String;


  // ============================================================
  // Release
  // ============================================================

  action releasePurchaseOrder(
    poNumber : String(10)
  ) returns String;


  // ============================================================
  // Goods Receipt
  // ============================================================

  type GoodsReceiptLine {
    itemId   : String(30);
    quantity : Decimal(13,3);
  }

  action postGoodsReceipt(
    poNumber     : String(10),
    postingDate  : Date,
    deliveryNote : String(100),
    items        : many GoodsReceiptLine
  ) returns String;


  // ============================================================
  // Cancellation
  // ============================================================

  action cancelPurchaseOrder(
    poNumber : String(10),
    comment : String(500)
  ) returns String;


  // ============================================================
  // Closing
  // ============================================================

  action closePurchaseOrder(
    poNumber : String(10)
  ) returns String;

}