namespace purchase.order.processing;

entity Suppliers {
  key ID        : String(20);
      name      : String(100);
      city       : String(50);
      contact    : String(100);
      email      : String(120);
      phone      : String(30);
      address    : String(200);
      status     : String(20);
}

entity PurchaseOrders {
  key poNumber       : String(10);
      supplier       : Association to Suppliers;
      companyCode    : String(10);
      purchasingOrg   : String(10);
      purchasingGroup : String(10);
      documentDate    : Date;
      currency        : String(3);
      status          : String(20);
      approvalStatus  : String(20);
      createdBy       : String(100);
      createdAt       : Timestamp;
      changedAt       : Timestamp;
      deliveryDate    : Date;
      paymentTerms    : String(30);
      incoterms       : String(10);
      reference       : String(100);
      note            : String(500);

      items : Composition of many PurchaseOrderItems
              on items.poNumber = $self.poNumber;

      approvals : Composition of many Approvals
                  on approvals.poNumber = $self.poNumber;

      statusHistory : Composition of many PurchaseOrderStatusHistory
                      on statusHistory.poNumber = $self.poNumber;
}

entity PurchaseOrderItems {
  key itemId       : String(30);
      poNumber     : String(10);
      material     : String(30);
      description  : String(200);
      quantity     : Decimal(13,3);
      unit         : String(5);
      unitPrice    : Decimal(15,2);
      netValue     : Decimal(15,2);
      status       : String(20);
}

entity Approvals {
  key approvalId : String(30);
      poNumber   : String(10);
      supplier   : String(100);
      amount     : Decimal(15,2);
      createdBy  : String(100);
      createdOn  : Date;
      approver   : String(100);
      status     : String(20);
      comments   : String(500);
}

entity GoodsReceipts {
  key receiptId    : String(30);
      poNumber     : String(10);
      postingDate   : Date;
      receivedBy    : String(100);
      deliveryNote : String(100);
      status       : String(20);
      createdAt     : Timestamp;
}

entity GoodsReceiptItems {
  key receiptItemId : String(40);
      receiptId     : String(30);
      poNumber      : String(10);
      itemId        : String(30);
      material      : String(30);
      description   : String(200);
      quantity      : Decimal(13,3);
      unit          : String(5);
      receivedDate  : Date;
}


// ============================================================
// PURCHASE ORDER LIFECYCLE / STATUS HISTORY
// ============================================================

entity PurchaseOrderStatusHistory {
  key historyId : String(40);

      poNumber   : String(10);

      fromStatus : String(30);

      toStatus   : String(30);

      action     : String(50);

      changedBy  : String(100);

      changedAt  : Timestamp;

      comment    : String(500);
}