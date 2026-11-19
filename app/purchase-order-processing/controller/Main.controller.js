sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/m/Popover",
  "sap/m/List",
  "sap/m/StandardListItem",
  "sap/m/VBox",
  "sap/m/HBox",
  "sap/m/Text",
  "sap/m/Button",
  "sap/m/Dialog",
  "sap/m/Label",
  "sap/m/Input",
  "sap/m/Switch",
  "sap/m/Select",
  "sap/m/ObjectStatus",
  "sap/ui/core/Item",
  "purchaseorderprocessing/controller/api"
], function (
  Controller,
  JSONModel,
  MessageToast,
  MessageBox,
  Popover,
  List,
  StandardListItem,
  VBox,
  HBox,
  Text,
  Button,
  Dialog,
  Label,
  Input,
  Switch,
  Select,
  ObjectStatus,
  Item,
  api
) {
  "use strict";

  return Controller.extend(
    "purchaseorderprocessing.controller.Main",
    {

      /* =========================================================
         INITIALIZATION
         ========================================================= */

      onInit: function () {

        this.getView().setModel(
          new JSONModel({
            total: 0,
            spend: 0,
            averagePOValue: 0,
            spendThisMonth: 0,
            totalPOItems: 0,

            pending: 0,
            pendingApprovalValue: 0,
            activeSuppliers: 0,
            highestPOValue: 0,
            averageSpendPerSupplier: 0,

            released: 0,
            blocked: 0,
            rejected: 0,
            cancelled: 0,

            months: Array.from(
              { length: 12 },
              function () {
                return {
                  value: 0
                };
              }
            ),

            monthData: [],
            monthSummary: "Loading...",
            recent: [],
            loading: true
          }),
          "dashboard"
        );

        this._load();
      },


      /* =========================================================
         COMPACT CURRENCY FORMATTER
         ========================================================= */

      formatCompactCurrency: function (value) {

        if (
          value === null ||
          value === undefined ||
          value === ""
        ) {
          return "₹0";
        }

        var numericValue = Number(
          String(value)
            .replace(/,/g, "")
            .replace(/₹/g, "")
            .trim()
        );

        if (isNaN(numericValue)) {
          return "₹0";
        }

        var absValue = Math.abs(numericValue);
        var formatted;

        if (absValue >= 1000000000) {

          formatted =
            (numericValue / 1000000000)
              .toFixed(2) + "B";

        } else if (absValue >= 1000000) {

          formatted =
            (numericValue / 1000000)
              .toFixed(2) + "M";

        } else if (absValue >= 1000) {

          formatted =
            (numericValue / 1000)
              .toFixed(2) + "K";

        } else {

          formatted =
            numericValue.toFixed(0);
        }

        formatted = formatted
          .replace(/\.00([KMB])$/, "$1")
          .replace(/(\.\d)0([KMB])$/, "$1$2");

        return "₹" + formatted;
      },


      /* =========================================================
         LOAD DASHBOARD DATA
         ========================================================= */

      _load: async function () {

        var model =
          this.getView().getModel("dashboard");

        model.setProperty(
          "/loading",
          true
        );

        try {

          var results = await Promise.all([
            api.list("PurchaseOrders"),
            api.list("PurchaseOrderItems"),
            api.list("Suppliers")
          ]);

          var poRes = results[0];
          var itemRes = results[1];
          var supplierRes = results[2];

          var orders =
            Array.isArray(
              poRes && poRes.value
            )
              ? poRes.value
              : [];

          var items =
            Array.isArray(
              itemRes && itemRes.value
            )
              ? itemRes.value
              : [];

          var suppliers =
            Array.isArray(
              supplierRes && supplierRes.value
            )
              ? supplierRes.value
              : [];


          /* =====================================================
             SUPPLIER LOOKUP
             ===================================================== */

          var supplierMap = {};

          suppliers.forEach(
            function (supplier) {

              supplierMap[supplier.ID] =
                supplier.name;

            }
          );


          /* =====================================================
             GROUP ITEMS BY PO
             ===================================================== */

          var itemsByPO = {};

          items.forEach(
            function (item) {

              if (
                !itemsByPO[item.poNumber]
              ) {
                itemsByPO[item.poNumber] = [];
              }

              itemsByPO[item.poNumber].push(
                item
              );

            }
          );


          /* =====================================================
             CALCULATE PO NET VALUE
             ===================================================== */

          var net = function (po) {

            var poItems =
              itemsByPO[po.poNumber] || [];

            return poItems.reduce(
              function (sum, item) {

                return sum +
                  Number(
                    item.netValue || 0
                  );

              },
              0
            );
          };


          /* =====================================================
             STATUS COUNTS
             ===================================================== */

          var counts = {
            total: orders.length,
            pending: 0,
            released: 0,
            blocked: 0,
            rejected: 0,
            cancelled: 0
          };


          orders.forEach(
            function (po) {

              var status =
                String(
                  po.status || ""
                )
                  .trim()
                  .toLowerCase();

              switch (status) {

                case "released":
                  counts.released++;
                  break;

                case "blocked":
                  counts.blocked++;
                  break;

                case "rejected":
                  counts.rejected++;
                  break;

                case "cancelled":
                case "canceled":
                  counts.cancelled++;
                  break;

                default:
                  break;
              }

            }
          );


          /* =====================================================
             PENDING APPROVAL
             ===================================================== */

          counts.pending =
            orders.filter(
              function (po) {

                var approvalStatus =
                  String(
                    po.approvalStatus || ""
                  )
                    .trim()
                    .toLowerCase();

                return (
                  approvalStatus === "pending" ||
                  approvalStatus === "pending approval"
                );

              }
            ).length - 1;

          counts.pending =
            Math.max(
              counts.pending,
              0
            );


          /* =====================================================
             TOTAL SPEND
             ===================================================== */

          var spend =
            orders.reduce(
              function (sum, po) {

                return sum + net(po);

              },
              0
            );


          /* =====================================================
             AVERAGE PO VALUE
             ===================================================== */

          var averagePOValue =
            orders.length > 0
              ? spend / orders.length
              : 0;


          /* =====================================================
             CURRENT MONTH SPEND
             ===================================================== */

          var now = new Date();

          var currentYear =
            now.getFullYear();

          var currentMonth =
            now.getMonth();

          var spendThisMonth = 0;

          orders.forEach(
            function (po) {

              if (!po.documentDate) {
                return;
              }

              var date =
                new Date(
                  po.documentDate
                );

              if (
                date.getFullYear() ===
                  currentYear &&
                date.getMonth() ===
                  currentMonth
              ) {

                spendThisMonth +=
                  net(po);

              }

            }
          );


          /* =====================================================
             TOTAL PO ITEMS
             ===================================================== */

          var totalPOItems =
            items.length;


          /* =====================================================
             PENDING APPROVAL VALUE
             ===================================================== */

          var pendingOrders =
            orders.filter(
              function (po) {

                var approvalStatus =
                  String(
                    po.approvalStatus || ""
                  )
                    .trim()
                    .toLowerCase();

                return (
                  approvalStatus === "pending" ||
                  approvalStatus === "pending approval"
                );

              }
            );


          var pendingApprovalValue =
            pendingOrders.reduce(
              function (sum, po) {

                return sum + net(po);

              },
              0
            );


          pendingApprovalValue =
            Math.max(
              pendingApprovalValue,
              0
            );


          /* =====================================================
             ACTIVE SUPPLIERS
             ===================================================== */

          var activeSupplierIds =
            new Set(
              orders
                .map(
                  function (po) {
                    return po.supplier_ID;
                  }
                )
                .filter(Boolean)
            );

          var activeSuppliers =
            activeSupplierIds.size;


          /* =====================================================
             HIGHEST PO VALUE
             ===================================================== */

          var highestPOValue =
            orders.length > 0
              ? Math.max.apply(
                  null,
                  orders.map(
                    function (po) {
                      return net(po);
                    }
                  )
                )
              : 0;


          /* =====================================================
             AVERAGE SPEND PER SUPPLIER
             ===================================================== */

          var averageSpendPerSupplier =
            activeSuppliers > 0
              ? spend / activeSuppliers
              : 0;


          /* =====================================================
             MONTHLY SPEND
             ===================================================== */

          var monthly =
            Array(12).fill(0);

          var year =
            new Date().getFullYear();

          orders.forEach(
            function (po) {

              if (!po.documentDate) {
                return;
              }

              var date =
                new Date(
                  po.documentDate
                );

              if (
                date.getFullYear() === year &&
                date.getMonth() >= 0 &&
                date.getMonth() < 12
              ) {

                monthly[
                  date.getMonth()
                ] += net(po);

              }

            }
          );


          var monthNames = [
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


          var monthData =
            monthly.map(
              function (value, index) {

                return {
                  month:
                    monthNames[index],

                  spend:
                    value
                };

              }
            );


          var max =
            Math.max.apply(
              null,
              monthly.concat([1])
            );


          /* =====================================================
             RECENT PURCHASE ORDERS
             ===================================================== */

          var recent =
            orders
              .slice()
              .sort(
                function (a, b) {

                  return String(
                    b.documentDate || ""
                  ).localeCompare(
                    String(
                      a.documentDate || ""
                    )
                  );

                }
              )
              .slice(0, 10)
              .map(
                function (po) {

                  return {

                    poNumber:
                      po.poNumber,

                    supplier:
                      supplierMap[
                        po.supplier_ID
                      ] ||
                      po.supplier_ID ||
                      "",

                    documentDate:
                      po.documentDate ||
                      "",

                    netValue:
                      net(po),

                    status:
                      po.status ||
                      ""

                  };

                }
              );


          /* =====================================================
             UPDATE MODEL
             ===================================================== */

          model.setData({

            total:
              counts.total,

            spend:
              spend,

            averagePOValue:
              averagePOValue,

            spendThisMonth:
              spendThisMonth,

            totalPOItems:
              totalPOItems,

            pending:
              counts.pending,

            pendingApprovalValue:
              pendingApprovalValue,

            activeSuppliers:
              activeSuppliers,

            highestPOValue:
              highestPOValue,

            averageSpendPerSupplier:
              averageSpendPerSupplier,

            released:
              counts.released,

            blocked:
              counts.blocked,

            rejected:
              counts.rejected,

            cancelled:
              counts.cancelled,

            months:
              monthly.map(
                function (value) {

                  return {
                    value:
                      Math.round(
                        value * 100 / max
                      )
                  };

                }
              ),

            monthData:
              monthData,

            monthSummary:
              "Year-to-date net spend: ₹ " +
              spend.toLocaleString(
                "en-IN",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }
              ),

            recent:
              recent,

            loading:
              false

          });

          return true;

        } catch (error) {

          model.setProperty(
            "/loading",
            false
          );

          MessageBox.error(
            "Unable to load procurement data.\n\n" +
            error.message
          );

          console.error(
            "Dashboard loading error:",
            error
          );

          return false;
        }
      },


      /* =========================================================
         STATUS FORMATTER
         ========================================================= */

      statusState: function (status) {

        var value =
          String(status || "")
            .trim()
            .toLowerCase();

        if (value === "released") {
          return "Success";
        }

        if (value === "pending") {
          return "Warning";
        }

        if (
          value === "blocked" ||
          value === "rejected"
        ) {
          return "Error";
        }

        return "None";
      },


      /* =========================================================
         NAVIGATION
         ========================================================= */

      onHome: function () {
        // Already on dashboard.
      },


      onPurchaseOrders: function () {

        this.getOwnerComponent()
          .getRouter()
          .navTo("poList");

      },


      onSuppliers: function () {

        this.getOwnerComponent()
          .getRouter()
          .navTo("suppliers");

      },


      onApprovals: function () {

        this.getOwnerComponent()
          .getRouter()
          .navTo("approvals");

      },


      onCreate: function () {

        this.getOwnerComponent()
          .getRouter()
          .navTo("createPO");

      },


      onReports: function () {

        this.getOwnerComponent()
          .getRouter()
          .navTo("reports");

      },


      /* =========================================================
         REFRESH
         ========================================================= */

      onRefresh: async function () {

        this.getView().setBusy(true);

        try {

          var refreshed =
            await this._load();

          if (refreshed) {

            MessageToast.show(
              "Procurement data refreshed."
            );

          }

        } finally {

          this.getView().setBusy(false);

        }
      },


      /* =========================================================
         NOTIFICATIONS
         ========================================================= */

      onNotifications: function (event) {

        var source =
          event.getSource();

        if (this._notificationPopover) {

          this._notificationPopover.destroy();

          this._notificationPopover = null;
        }

        var model =
          this.getView()
            .getModel("dashboard");

        var pending =
          Number(
            model.getProperty("/pending") || 0
          );

        var blocked =
          Number(
            model.getProperty("/blocked") || 0
          );

        var rejected =
          Number(
            model.getProperty("/rejected") || 0
          );


        var list =
          new List({
            showSeparators: "Inner"
          });


        if (pending > 0) {

          var pendingItem =
            new StandardListItem({

              title:
                pending +
                " purchase order" +
                (
                  pending === 1
                    ? ""
                    : "s"
                ) +
                " pending approval",

              description:
                "Review the approval queue.",

              icon:
                "sap-icon://pending",

              type:
                "Navigation"

            });


          pendingItem.attachPress(
            function () {

              this._notificationPopover.close();

              this.onApprovals();

            },
            this
          );


          list.addItem(
            pendingItem
          );
        }


        if (blocked > 0) {

          var blockedItem =
            new StandardListItem({

              title:
                blocked +
                " blocked purchase order" +
                (
                  blocked === 1
                    ? ""
                    : "s"
                ),

              description:
                "Review blocked purchase orders.",

              icon:
                "sap-icon://locked",

              type:
                "Navigation"

            });


          blockedItem.attachPress(
            function () {

              this._notificationPopover.close();

              this.onPurchaseOrders();

            },
            this
          );


          list.addItem(
            blockedItem
          );
        }


        if (rejected > 0) {

          var rejectedItem =
            new StandardListItem({

              title:
                rejected +
                " rejected purchase order" +
                (
                  rejected === 1
                    ? ""
                    : "s"
                ),

              description:
                "Review rejected purchase orders.",

              icon:
                "sap-icon://decline",

              type:
                "Navigation"

            });


          rejectedItem.attachPress(
            function () {

              this._notificationPopover.close();

              this.onPurchaseOrders();

            },
            this
          );


          list.addItem(
            rejectedItem
          );
        }


        if (
          list.getItems().length === 0
        ) {

          list.addItem(
            new StandardListItem({

              title:
                "No new notifications",

              description:
                "No procurement items require attention.",

              icon:
                "sap-icon://accept"

            })
          );

        }


        this._notificationPopover =
          new Popover({

            title:
              "Notifications",

            placement:
              "Bottom",

            contentWidth:
              "24rem",

            content:
              [list]

          });


        this.getView().addDependent(
          this._notificationPopover
        );


        this._notificationPopover.openBy(
          source
        );
      },


      /* =========================================================
         PROFILE MENU
         ========================================================= */

      onProfile: function (event) {

        var source =
          event.getSource();


        if (this._profilePopover) {

          this._profilePopover.destroy();

          this._profilePopover = null;
        }


        /* -------------------------------------------------------
           BASIC PROFILE HEADER
           Only name and role appear here.
           ------------------------------------------------------- */

        var profileName =
          new Text({
            text:
              "Sannapaneni Sai"
          });

        profileName.addStyleClass(
          "toolbarProfileName"
        );


        var profileRole =
          new Text({
            text:
              "Procurement User"
          });

        profileRole.addStyleClass(
          "toolbarProfileRole"
        );


        var profileHeader =
          new VBox({

            items: [
              profileName,
              profileRole
            ]

          });


        profileHeader.addStyleClass(
          "toolbarProfileHeader"
        );


        /* -------------------------------------------------------
           MY PROFILE
           ------------------------------------------------------- */

        var profileButton =
          new Button({

            text:
              "My Profile",

            icon:
              "sap-icon://person-placeholder",

            type:
              "Transparent",

            width:
              "100%"

          });


        profileButton.addStyleClass(
          "profileMenuButton"
        );


        profileButton.attachPress(
          function () {

            this._profilePopover.close();

            this._openProfileDetails();

          },
          this
        );


        /* -------------------------------------------------------
           SETTINGS
           ------------------------------------------------------- */

        var settingsButton =
          new Button({

            text:
              "Settings",

            icon:
              "sap-icon://action-settings",

            type:
              "Transparent",

            width:
              "100%"

          });


        settingsButton.addStyleClass(
          "profileMenuButton"
        );


        settingsButton.attachPress(
          function () {

            this._profilePopover.close();

            this._openSettings();

          },
          this
        );


        /* -------------------------------------------------------
           SIGN OUT
           ------------------------------------------------------- */

        var signOutButton =
          new Button({

            text:
              "Sign Out",

            icon:
              "sap-icon://log",

            type:
              "Transparent",

            width:
              "100%"

          });


        signOutButton.addStyleClass(
          "profileMenuButton"
        );


        signOutButton.attachPress(
          function () {

            this._profilePopover.close();

            MessageBox.confirm(
              "Are you sure you want to sign out?",
              {

                title:
                  "Sign Out",

                actions: [
                  MessageBox.Action.YES,
                  MessageBox.Action.NO
                ],

                emphasizedAction:
                  MessageBox.Action.YES,

                onClose:
                  function (action) {

                    if (
                      action ===
                      MessageBox.Action.YES
                    ) {

                      MessageToast.show(
                        "Sign-out is not connected to an authentication service yet."
                      );

                    }

                  }

              }
            );

          },
          this
        );


        /* -------------------------------------------------------
           POPOVER
           ------------------------------------------------------- */

        var content =
          new VBox({

            width:
              "18rem",

            items: [
              profileHeader,
              profileButton,
              settingsButton,
              signOutButton
            ]

          });


        content.addStyleClass(
          "profilePopoverContent"
        );


        this._profilePopover =
          new Popover({

            placement:
              "Bottom",

            contentWidth:
              "18rem",

            showHeader:
              false,

            content:
              [content]

          });


        this.getView().addDependent(
          this._profilePopover
        );


        this._profilePopover.openBy(
          source
        );
      },


      /* =========================================================
         PROFILE DETAILS
         ========================================================= */

      _openProfileDetails: function () {

        if (this._profileDialog) {

          this._profileDialog.destroy();

          this._profileDialog = null;
        }


        /* -------------------------------------------------------
           LOAD SAVED PROFILE DATA
           ------------------------------------------------------- */

        var profile = {

          name:
            localStorage.getItem(
              "profileName"
            ) ||
            "Sannapaneni Sai",

          email:
            localStorage.getItem(
              "profileEmail"
            ) ||
            "saisannapaneni@gmail.com",

          department:
            localStorage.getItem(
              "profileDepartment"
            ) ||
            "Procurement / IT",

          role:
            "Procurement User",

          employeeId:
            "SP-PROC-001",

          status:
            "Active"

        };


        /* -------------------------------------------------------
           CREATE PROFILE ROW
           ------------------------------------------------------- */

        var createProfileRow =
          function (label, value) {

            var labelText =
              new Text({

                text:
                  label,

                width:
                  "8rem"

              });

            labelText.addStyleClass(
              "profileRowLabel"
            );


            var valueText =
              new Text({

                text:
                  value,

                wrapping:
                  true

              });

            valueText.addStyleClass(
              "profileRowValue"
            );


            var row =
              new HBox({

                width:
                  "100%",

                alignItems:
                  "Center",

                items: [

                  labelText,

                  valueText

                ]

              });

            row.addStyleClass(
              "profileRow"
            );


            return row;
          };


        /* -------------------------------------------------------
           STATUS ROW
           ------------------------------------------------------- */

        var statusLabel =
          new Text({

            text:
              "Status",

            width:
              "8rem"

          });

        statusLabel.addStyleClass(
          "profileRowLabel"
        );


        var statusValue =
          new Text({

            text:
              "● Active"

          });

        statusValue.addStyleClass(
          "profileStatusText"
        );


        var statusRow =
          new HBox({

            width:
              "100%",

            alignItems:
              "Center",

            items: [

              statusLabel,

              statusValue

            ]

          });

        statusRow.addStyleClass(
          "profileRow"
        );


        /* -------------------------------------------------------
           PROFILE CONTENT
           ------------------------------------------------------- */

        var profileDetails =
          new VBox({

            width:
              "100%",

            items: [

              createProfileRow(
                "Name",
                profile.name
              ),

              createProfileRow(
                "Role",
                profile.role
              ),

              createProfileRow(
                "Email",
                profile.email
              ),

              createProfileRow(
                "Department",
                profile.department
              ),

              createProfileRow(
                "Employee ID",
                profile.employeeId
              ),

              statusRow

            ]

          });


        profileDetails.addStyleClass(
          "profileDetailsCompact"
        );


        /* -------------------------------------------------------
           EDIT BUTTON
           ------------------------------------------------------- */

        var editButton =
          new Button({

            text:
              "Edit",

            icon:
              "sap-icon://edit",

            type:
              "Emphasized",

            press:
              function () {

                this._openProfileEdit(
                  profile
                );

              }.bind(this)

          });


        /* -------------------------------------------------------
           PROFILE DIALOG
           ------------------------------------------------------- */

        this._profileDialog =
          new Dialog({

            title:
              "My Profile",

            contentWidth:
              "34rem",

            content:
              [
                profileDetails
              ],

            beginButton:
    new Button({

        text: "Cancel",

        press: function () {

            this._profileDialog.close();

        }.bind(this)

    }),

endButton:
    editButton,

            afterClose:
              function () {

                if (
                  this._profileDialog
                ) {

                  this._profileDialog.destroy();

                  this._profileDialog = null;

                }

              }.bind(this)

          });


        this.getView().addDependent(
          this._profileDialog
        );


        this._profileDialog.open();
      },
            /* =========================================================
         EDIT PROFILE
         ========================================================= */

      _openProfileEdit: function (profile) {

        if (this._profileDialog) {

          this._profileDialog.close();

        }


        /* -------------------------------------------------------
           EDITABLE NAME
           ------------------------------------------------------- */

        var nameInput =
          new Input({

            value:
              profile.name,

            width:
              "100%",

            placeholder:
              "Enter your name"

          });


        /* -------------------------------------------------------
           EDITABLE EMAIL
           ------------------------------------------------------- */

        var emailInput =
          new Input({

            value:
              profile.email,

            width:
              "100%",

            type:
              "Email",

            placeholder:
              "Enter your email"

          });


        /* -------------------------------------------------------
           EDITABLE DEPARTMENT
           ------------------------------------------------------- */

        var departmentInput =
          new Input({

            value:
              profile.department,

            width:
              "100%",

            placeholder:
              "Enter department"

          });


        /* -------------------------------------------------------
           READ-ONLY ROLE
           ------------------------------------------------------- */

        var roleInput =
          new Input({

            value:
              profile.role,

            width:
              "100%",

            editable:
              false

          });


        /* -------------------------------------------------------
           READ-ONLY EMPLOYEE ID
           ------------------------------------------------------- */

        var employeeInput =
          new Input({

            value:
              profile.employeeId,

            width:
              "100%",

            editable:
              false

          });


        /* -------------------------------------------------------
           NAME FIELD
           ------------------------------------------------------- */

        var nameLabel =
          new Label({
            text:
              "Name"
          });

        nameLabel.addStyleClass(
          "settingsLabel"
        );


        /* -------------------------------------------------------
           EMAIL FIELD
           ------------------------------------------------------- */

        var emailLabel =
          new Label({
            text:
              "Email"
          });

        emailLabel.addStyleClass(
          "settingsLabel"
        );


        /* -------------------------------------------------------
           DEPARTMENT FIELD
           ------------------------------------------------------- */

        var departmentLabel =
          new Label({
            text:
              "Department"
          });

        departmentLabel.addStyleClass(
          "settingsLabel"
        );


        /* -------------------------------------------------------
           ROLE FIELD
           ------------------------------------------------------- */

        var roleLabel =
          new Label({
            text:
              "Role"
          });

        roleLabel.addStyleClass(
          "settingsLabel"
        );


        /* -------------------------------------------------------
           EMPLOYEE ID FIELD
           ------------------------------------------------------- */

        var employeeLabel =
          new Label({
            text:
              "Employee ID"
          });

        employeeLabel.addStyleClass(
          "settingsLabel"
        );


        /* -------------------------------------------------------
           EDIT CONTENT
           ------------------------------------------------------- */

        var editContent =
          new VBox({

            width:
              "100%",

            items: [

              new Text({
                text:
                  "Edit Profile Information"
              }).addStyleClass(
                "profileSectionTitle"
              ),

              nameLabel,
              nameInput,

              emailLabel,
              emailInput,

              departmentLabel,
              departmentInput,

              roleLabel,
              roleInput,

              employeeLabel,
              employeeInput

            ]

          });


        editContent.addStyleClass(
          "profileEditContent"
        );


        /* -------------------------------------------------------
           VALIDATION
           ------------------------------------------------------- */

        var validateProfile =
          function () {

            var name =
              nameInput.getValue()
                .trim();

            var email =
              emailInput.getValue()
                .trim();

            var department =
              departmentInput.getValue()
                .trim();


            if (!name) {

              MessageBox.warning(
                "Please enter your name."
              );

              return false;
            }


            if (!email) {

              MessageBox.warning(
                "Please enter your email address."
              );

              return false;
            }


            var emailPattern =
              /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


            if (
              !emailPattern.test(email)
            ) {

              MessageBox.warning(
                "Please enter a valid email address."
              );

              return false;
            }


            if (!department) {

              MessageBox.warning(
                "Please enter your department."
              );

              return false;
            }


            return true;
          };


        /* -------------------------------------------------------
           SAVE
           ------------------------------------------------------- */

        var saveButton =
          new Button({

            text:
              "Save",

            icon:
              "sap-icon://save",

            type:
              "Emphasized"

          });


        saveButton.attachPress(
          function () {

            if (!validateProfile()) {
              return;
            }


            var updatedName =
              nameInput.getValue()
                .trim();

            var updatedEmail =
              emailInput.getValue()
                .trim();

            var updatedDepartment =
              departmentInput.getValue()
                .trim();


            try {

              localStorage.setItem(
                "profileName",
                updatedName
              );

              localStorage.setItem(
                "profileEmail",
                updatedEmail
              );

              localStorage.setItem(
                "profileDepartment",
                updatedDepartment
              );

            } catch (error) {

              MessageBox.error(
                "Unable to save profile information."
              );

              console.error(
                "Profile save error:",
                error
              );

              return;
            }


            /* Update current profile object */

            profile.name =
              updatedName;

            profile.email =
              updatedEmail;

            profile.department =
              updatedDepartment;


            this._profileEditDialog.close();


            MessageToast.show(
              "Profile updated successfully."
            );


            /* Reopen profile with updated data */

            setTimeout(
              function () {

                this._openProfileDetails();

              }.bind(this),
              250
            );

          },
          this
        );


        /* -------------------------------------------------------
           CANCEL
           ------------------------------------------------------- */

        var cancelButton =
          new Button({

            text:
              "Cancel",

            press:
              function () {

                this._profileEditDialog.close();

              }.bind(this)

          });


        /* -------------------------------------------------------
           EDIT PROFILE DIALOG
           ------------------------------------------------------- */

        this._profileEditDialog =
          new Dialog({

            title:
              "Edit Profile",

            contentWidth:
              "34rem",

            content:
              [editContent],

            beginButton:
              saveButton,

            endButton:
              cancelButton,

            afterClose:
              function () {

                this._profileEditDialog.destroy();

                this._profileEditDialog = null;

              }.bind(this)

          });


        this.getView().addDependent(
          this._profileEditDialog
        );


        this._profileEditDialog.open();
      },


      /* =========================================================
         SETTINGS
         ========================================================= */

      _openSettings: function () {

        if (this._settingsDialog) {

          this._settingsDialog.destroy();

          this._settingsDialog = null;
        }


        /* -------------------------------------------------------
           APPEARANCE
           ------------------------------------------------------- */

        var appearanceSelect =
          new Select({

            width:
              "100%",

            selectedKey:
              localStorage.getItem(
                "poAppearance"
              ) || "light",

            items: [

              new Item({
                key:
                  "light",

                text:
                  "Light"
              }),

              new Item({
                key:
                  "dark",

                text:
                  "Dark"
              }),

              new Item({
                key:
                  "system",

                text:
                  "Use system setting"
              })

            ]

          });


        /* -------------------------------------------------------
           NOTIFICATIONS
           ------------------------------------------------------- */

        var notificationSwitch =
          new Switch({

            state:
              localStorage.getItem(
                "poNotifications"
              ) !== "false"

          });


        /* -------------------------------------------------------
           AUTO REFRESH
           ------------------------------------------------------- */

        var autoRefreshSwitch =
          new Switch({

            state:
              localStorage.getItem(
                "poAutoRefresh"
              ) === "true"

          });


        /* -------------------------------------------------------
           DEFAULT LANDING PAGE
           ------------------------------------------------------- */

        var defaultPageSelect =
          new Select({

            width:
              "100%",

            selectedKey:
              localStorage.getItem(
                "poDefaultPage"
              ) || "home",

            items: [

              new Item({
                key:
                  "home",

                text:
                  "Procurement Overview"
              }),

              new Item({
                key:
                  "poList",

                text:
                  "Purchase Orders"
              }),

              new Item({
                key:
                  "suppliers",

                text:
                  "Suppliers"
              }),

              new Item({
                key:
                  "approvals",

                text:
                  "Approvals"
              }),

              new Item({
                key:
                  "reports",

                text:
                  "Reports"
              })

            ]

          });


        /* -------------------------------------------------------
           SETTINGS TITLE
           ------------------------------------------------------- */

        var settingsTitle =
          new Text({
            text:
              "Application Preferences"
          });

        settingsTitle.addStyleClass(
          "settingsSectionTitle"
        );


        /* -------------------------------------------------------
           SETTINGS LABELS
           ------------------------------------------------------- */

        var appearanceLabel =
          new Label({
            text:
              "Appearance"
          });

        appearanceLabel.addStyleClass(
          "settingsLabel"
        );


        var notificationLabel =
          new Label({
            text:
              "Notifications"
          });

        notificationLabel.addStyleClass(
          "settingsLabel"
        );


        var autoRefreshLabel =
          new Label({
            text:
              "Automatic Refresh"
          });

        autoRefreshLabel.addStyleClass(
          "settingsLabel"
        );


        var defaultPageLabel =
          new Label({
            text:
              "Default Landing Page"
          });

        defaultPageLabel.addStyleClass(
          "settingsLabel"
        );


        /* -------------------------------------------------------
           NOTIFICATION ROW
           ------------------------------------------------------- */

        var notificationText =
          new Text({
            text:
              "Receive procurement notifications"
          });


        var notificationRow =
          new VBox({

            items: [
              notificationText,
              notificationSwitch
            ]

          });

        notificationRow.addStyleClass(
          "settingsSwitchRow"
        );


        /* -------------------------------------------------------
           AUTO REFRESH ROW
           ------------------------------------------------------- */

        var autoRefreshText =
          new Text({
            text:
              "Automatically refresh procurement data"
          });


        var autoRefreshRow =
          new VBox({

            items: [
              autoRefreshText,
              autoRefreshSwitch
            ]

          });

        autoRefreshRow.addStyleClass(
          "settingsSwitchRow"
        );


        /* -------------------------------------------------------
           SETTINGS CONTENT
           ------------------------------------------------------- */

        var settingsContent =
          new VBox({

            width:
              "100%",

            items: [

              settingsTitle,

              appearanceLabel,
              appearanceSelect,

              notificationLabel,
              notificationRow,

              autoRefreshLabel,
              autoRefreshRow,

              defaultPageLabel,
              defaultPageSelect

            ]

          });


        settingsContent.addStyleClass(
          "settingsContent"
        );


        /* -------------------------------------------------------
           SAVE SETTINGS
           ------------------------------------------------------- */

        var saveSettingsButton =
          new Button({

            text:
              "Save",

            icon:
              "sap-icon://save",

            type:
              "Emphasized"

          });


        saveSettingsButton.attachPress(
          function () {

            try {

              localStorage.setItem(
                "poAppearance",
                appearanceSelect.getSelectedKey()
              );

              localStorage.setItem(
                "poNotifications",
                String(
                  notificationSwitch.getState()
                )
              );

              localStorage.setItem(
                "poAutoRefresh",
                String(
                  autoRefreshSwitch.getState()
                )
              );

              localStorage.setItem(
                "poDefaultPage",
                defaultPageSelect.getSelectedKey()
              );

            } catch (error) {

              MessageBox.error(
                "Unable to save application settings."
              );

              console.error(
                "Settings save error:",
                error
              );

              return;
            }


            this._settingsDialog.close();


            MessageToast.show(
              "Settings saved successfully."
            );

          },
          this
        );


        /* -------------------------------------------------------
           CANCEL SETTINGS
           ------------------------------------------------------- */

        var cancelSettingsButton =
          new Button({

            text:
              "Cancel",

            press:
              function () {

                this._settingsDialog.close();

              }.bind(this)

          });


        /* -------------------------------------------------------
           SETTINGS DIALOG
           ------------------------------------------------------- */

        this._settingsDialog =
          new Dialog({

            title:
              "Settings",

            contentWidth:
              "34rem",

            content:
              [settingsContent],

            beginButton:
              saveSettingsButton,

            endButton:
              cancelSettingsButton,

            afterClose:
              function () {

                this._settingsDialog.destroy();

                this._settingsDialog = null;

              }.bind(this)

          });


        this.getView().addDependent(
          this._settingsDialog
        );


        this._settingsDialog.open();
      },
            /* =========================================================
         GLOBAL SEARCH
         ========================================================= */

      onGlobalSearch: function (event) {

        var value =
          String(
            event.getParameter("query") ||
            ""
          ).trim();


        if (!value) {
          return;
        }


        var searchValue =
          value.toLowerCase();


        var model =
          this.getView()
            .getModel("dashboard");


        var recent =
          model.getProperty("/recent") ||
          [];


        /* -------------------------------------------------------
           SEARCH PURCHASE ORDERS
           ------------------------------------------------------- */

        var matchingPO =
          recent.find(
            function (po) {

              return String(
                po.poNumber || ""
              )
                .toLowerCase()
                .includes(
                  searchValue
                );

            }
          );


        if (matchingPO) {

          this.getOwnerComponent()
            .getRouter()
            .navTo(
              "poDetail",
              {
                poNumber:
                  matchingPO.poNumber
              }
            );

          return;
        }


        /* -------------------------------------------------------
           APPLICATION SEARCH
           ------------------------------------------------------- */

        var applications = [

          {
            keywords:
              [
                "home",
                "dashboard"
              ],

            route:
              null,

            action:
              this.onHome.bind(this)
          },


          {
            keywords:
              [
                "purchase",
                "purchases",
                "orders",
                "purchase orders",
                "po"
              ],

            route:
              "poList"
          },


          {
            keywords:
              [
                "supplier",
                "suppliers"
              ],

            route:
              "suppliers"
          },


          {
            keywords:
              [
                "approval",
                "approvals"
              ],

            route:
              "approvals"
          },


          {
            keywords:
              [
                "report",
                "reports"
              ],

            route:
              "reports"
          },


          {
            keywords:
              [
                "create",
                "new",
                "new purchase order",
                "create purchase order"
              ],

            route:
              "createPO"
          }

        ];


        var application =
          applications.find(
            function (item) {

              return item.keywords.some(
                function (keyword) {

                  return (
                    keyword.includes(
                      searchValue
                    ) ||
                    searchValue.includes(
                      keyword
                    )
                  );

                }
              );

            }
          );


        if (application) {

          if (application.action) {

            application.action();

          } else {

            this.getOwnerComponent()
              .getRouter()
              .navTo(
                application.route
              );

          }

          return;
        }


        MessageToast.show(
          'No application or purchase order found for "' +
          value +
          '".'
        );
      },


      /* =========================================================
         RECENT PURCHASE ORDER
         ========================================================= */

      onRecentPress: function (event) {

        var context =
          event.getSource()
            .getBindingContext(
              "dashboard"
            );


        if (!context) {
          return;
        }


        var poNumber =
          context.getProperty(
            "poNumber"
          );


        this.getOwnerComponent()
          .getRouter()
          .navTo(
            "poDetail",
            {
              poNumber:
                poNumber
            }
          );
      }

    }
  );
});